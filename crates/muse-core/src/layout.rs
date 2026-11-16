//! Fit-to-screen layout for chord charts.
//!
//! Goal for live performance: show as much of the song as possible at the largest readable size,
//! and when a song cannot fit on one screen, split it into the fewest screen-sized pages so a page
//! turn (key, pedal, swipe) always moves exactly one screen.
//!
//! Reference evidence (E18): the SongBook Pro snapshot ships `ChoFitToPageOptimizer`,
//! `_blocksToColumns`, `columnsToPage`, `getFontScaleToFitToPage` and "Reduces the font size if
//! lines are too long to fit". Those symbols only name the problem; this algorithm is original:
//!
//! 1. The UI measures every rendered line once at scale 1 (natural width and height).
//! 2. For each column count `k` whose column is at least `min_column_width` wide, a greedy,
//!    order-preserving, section-aware packer counts the pages needed at a scale `s`. Wrapped lines
//!    contribute `ceil(width / column_width)` rows. Pages needed never decrease as `s` grows, so the
//!    largest scale meeting a page budget is found by binary search (as in textFit-style fitting).
//! 3. The page budget is the fewest pages any `k` achieves at `min_scale`. Candidates are compared
//!    lexicographically: pages, then font scale (within an 8% band), then wrapped lines, then
//!    fewer columns (reading continuity).
//! 4. The last page's columns are balanced by binary searching the smallest column cap that still
//!    packs its content (the classic linear-partition feasibility check).

use serde::{Deserialize, Serialize};

const SEARCH_STEPS: usize = 28;
const SCALE_BAND: f64 = 0.92;
const EPSILON: f64 = 0.5;

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default)]
pub struct FitLine {
    /// Natural (unwrapped) width in CSS pixels at scale 1.
    pub width: f64,
    /// Height in CSS pixels at scale 1.
    pub height: f64,
    /// Lines that cannot wrap (tabs, grids) must fit the column width.
    pub nowrap: bool,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default)]
pub struct FitBlock {
    pub lines: Vec<FitLine>,
    /// Fixed vertical chrome (padding, margins) in pixels, independent of scale.
    pub overhead: f64,
    /// Fixed horizontal chrome (indent, border) in pixels, independent of scale.
    pub indent: f64,
    /// The first line is a section heading that must stay with the next line.
    pub heading: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(default)]
pub struct FitRequest {
    pub blocks: Vec<FitBlock>,
    /// Space above the columns on the first page (title block), in pixels.
    pub header: f64,
    pub width: f64,
    pub height: f64,
    pub gap: f64,
    pub min_scale: f64,
    pub max_scale: f64,
    /// Comfortable reading scale. A layout without wrapped lines is preferred whenever one exists
    /// at or above this scale for the same page count ("reduce the font size if lines are too
    /// long to fit").
    pub comfort_scale: f64,
    pub min_column_width: f64,
    pub max_columns: usize,
}

impl Default for FitRequest {
    fn default() -> Self {
        Self {
            blocks: Vec::new(),
            header: 0.0,
            width: 1000.0,
            height: 800.0,
            gap: 32.0,
            min_scale: 0.8,
            max_scale: 2.4,
            comfort_scale: 1.0,
            min_column_width: 280.0,
            max_columns: 4,
        }
    }
}

/// A contiguous run of lines `start..end` from block `block`.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct Segment {
    pub block: usize,
    pub start: usize,
    pub end: usize,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct FitLayout {
    pub scale: f64,
    pub columns: usize,
    pub column_width: f64,
    /// `pages[page][column]` lists the segments shown in that column.
    pub pages: Vec<Vec<Vec<Segment>>>,
    pub wrapped_lines: usize,
    /// True when even the smallest readable scale needs more than one page.
    pub overflow: bool,
}

struct Packing {
    pages: usize,
    wrapped: usize,
    columns: Vec<Vec<Segment>>,
}

struct Geometry<'a> {
    request: &'a FitRequest,
    columns: usize,
    column_width: f64,
    scale: f64,
    allow_wrap: bool,
    /// Dense packing splits sections wherever a column fills instead of moving them whole.
    dense: bool,
}

impl Geometry<'_> {
    fn line_height(&self, block: &FitBlock, line: &FitLine) -> Option<(f64, bool)> {
        let room = (self.column_width - block.indent).max(1.0);
        let width = line.width * self.scale;
        if width <= room + EPSILON {
            return Some((line.height * self.scale, false));
        }
        if line.nowrap || !self.allow_wrap {
            return None;
        }
        let rows = (width / room).ceil();
        Some((line.height * self.scale * rows, true))
    }

    fn capacity(&self, column: usize) -> f64 {
        let first_page = column < self.columns;
        if first_page {
            self.request.height - self.request.header
        } else {
            self.request.height
        }
    }
}

/// Greedy, order-preserving packing. Returns `None` when a non-wrapping line is too wide.
/// `cap` optionally lowers every column's capacity (used for balancing).
fn pack(geometry: &Geometry<'_>, cap: Option<f64>) -> Option<Packing> {
    let capacity = |column: usize| {
        let full = geometry.capacity(column);
        cap.map_or(full, |c| c.min(full))
    };
    let mut columns: Vec<Vec<Segment>> = vec![Vec::new()];
    let mut used = 0.0;
    let mut wrapped = 0;
    for (index, block) in geometry.request.blocks.iter().enumerate() {
        let mut heights = Vec::with_capacity(block.lines.len());
        for line in &block.lines {
            let (height, wraps) = geometry.line_height(block, line)?;
            wrapped += usize::from(wraps);
            heights.push(height);
        }
        if heights.is_empty() {
            continue;
        }
        let total: f64 = heights.iter().sum::<f64>() + block.overhead;
        let column = columns.len() - 1;
        let remaining = capacity(column) - used;
        let fresh = capacity(column + 1);
        // Keep the section together when it fits here, or move it whole to the next column when it
        // fits there and moving wastes less than half a column.
        if total <= remaining + EPSILON {
            columns[column].push(Segment {
                block: index,
                start: 0,
                end: heights.len(),
            });
            used += total;
            continue;
        }
        let splittable = heights.len() >= 4;
        if !geometry.dense
            && total <= fresh + EPSILON
            && (!splittable || remaining < capacity(column) * 0.5)
        {
            columns.push(vec![Segment {
                block: index,
                start: 0,
                end: heights.len(),
            }]);
            used = total;
            continue;
        }
        // Split the section across columns, line by line.
        let mut start = 0;
        let mut overhead = block.overhead;
        while start < heights.len() {
            let column = columns.len() - 1;
            let mut room = capacity(column) - used - overhead;
            let mut end = start;
            while end < heights.len() && heights[end] <= room + EPSILON {
                room -= heights[end];
                end += 1;
            }
            // Never leave a heading alone at the bottom of a column.
            if block.heading && start == 0 && end == 1 && heights.len() > 1 {
                end = 0;
            }
            if end == start {
                if used == 0.0 {
                    // A single line taller than a whole column: place it anyway.
                    end = start + 1;
                } else {
                    columns.push(Vec::new());
                    used = 0.0;
                    continue;
                }
            }
            let height: f64 = heights[start..end].iter().sum::<f64>() + overhead;
            columns.last_mut()?.push(Segment {
                block: index,
                start,
                end,
            });
            used += height;
            overhead = 0.0;
            start = end;
            if start < heights.len() {
                columns.push(Vec::new());
                used = 0.0;
            }
        }
    }
    let pages = columns.len().div_ceil(geometry.columns).max(1);
    Some(Packing {
        pages,
        wrapped,
        columns,
    })
}

fn geometry(request: &FitRequest, columns: usize, scale: f64) -> Geometry<'_> {
    configured(
        request,
        columns,
        scale,
        Policy {
            allow_wrap: true,
            dense: false,
        },
    )
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct Policy {
    allow_wrap: bool,
    dense: bool,
}

const POLICIES: [Policy; 4] = [
    Policy {
        allow_wrap: false,
        dense: false,
    },
    Policy {
        allow_wrap: true,
        dense: false,
    },
    Policy {
        allow_wrap: false,
        dense: true,
    },
    Policy {
        allow_wrap: true,
        dense: true,
    },
];

fn configured(request: &FitRequest, columns: usize, scale: f64, policy: Policy) -> Geometry<'_> {
    let column_width = (request.width - request.gap * (columns as f64 - 1.0)) / columns as f64;
    Geometry {
        request,
        columns,
        column_width,
        scale,
        allow_wrap: policy.allow_wrap,
        dense: policy.dense,
    }
}

/// Fewest pages any packing policy reaches for `columns` at `scale`.
fn pages_at(request: &FitRequest, columns: usize, scale: f64) -> Option<usize> {
    POLICIES
        .iter()
        .filter_map(|&policy| pack(&configured(request, columns, scale, policy), None))
        .map(|p| p.pages)
        .min()
}

/// Largest scale in `[low, high]` whose packing needs at most `budget` pages.
fn largest_scale(
    request: &FitRequest,
    columns: usize,
    budget: usize,
    (low, high): (f64, f64),
    policy: Policy,
) -> Option<f64> {
    let fits = |s: f64| {
        pack(&configured(request, columns, s, policy), None).is_some_and(|p| p.pages <= budget)
    };
    if !fits(low) {
        return None;
    }
    if fits(high) {
        return Some(high);
    }
    let (mut good, mut bad) = (low, high);
    for _ in 0..SEARCH_STEPS {
        let mid = (good + bad) / 2.0;
        if fits(mid) {
            good = mid;
        } else {
            bad = mid;
        }
    }
    Some(good)
}

fn column_counts(request: &FitRequest) -> impl Iterator<Item = usize> + '_ {
    (1..=request.max_columns.max(1)).filter(move |&k| {
        k == 1 || geometry(request, k, 1.0).column_width >= request.min_column_width
    })
}

/// Splits packed columns into pages and evens out the columns of the last page.
fn paginate(
    request: &FitRequest,
    columns: usize,
    scale: f64,
    packing: Packing,
) -> Vec<Vec<Vec<Segment>>> {
    let mut pages: Vec<Vec<Vec<Segment>>> = packing
        .columns
        .chunks(columns)
        .map(|chunk| chunk.to_vec())
        .collect();
    if pages.is_empty() {
        return vec![vec![Vec::new(); columns]];
    }
    let last = pages.len() - 1;
    if pages[last].len() > 1 && columns > 1 {
        // Balance: find the smallest cap that still packs the last page's segments in `columns`.
        let segments: Vec<Segment> = pages[last].iter().flatten().copied().collect();
        if let Some(balanced) = balance(request, columns, scale, &segments, last == 0) {
            pages[last] = balanced;
        }
    }
    for page in &mut pages {
        page.resize(columns, Vec::new());
    }
    pages
}

fn balance(
    request: &FitRequest,
    columns: usize,
    scale: f64,
    segments: &[Segment],
    first_page: bool,
) -> Option<Vec<Vec<Segment>>> {
    // Rebuild a request containing only the last page's content as whole sub-blocks.
    let blocks: Vec<FitBlock> = segments
        .iter()
        .map(|s| {
            let source = &request.blocks[s.block];
            FitBlock {
                lines: source.lines[s.start..s.end].to_vec(),
                overhead: if s.start == 0 { source.overhead } else { 0.0 },
                indent: source.indent,
                heading: source.heading && s.start == 0,
            }
        })
        .collect();
    let sub = FitRequest {
        blocks,
        header: if first_page { request.header } else { 0.0 },
        ..request.clone()
    };
    let geo = geometry(&sub, columns, scale);
    let full = geo.capacity(0);
    let packs = |cap: f64| pack(&geo, Some(cap)).filter(|p| p.columns.len() <= columns);
    packs(full)?;
    let (mut low, mut high) = (0.0, full);
    for _ in 0..SEARCH_STEPS {
        let mid = (low + high) / 2.0;
        if packs(mid).is_some() {
            high = mid;
        } else {
            low = mid;
        }
    }
    let packing = packs(high)?;
    // Map sub-block segments back to the original block indices and line offsets.
    let mapped = packing
        .columns
        .into_iter()
        .map(|column| {
            column
                .into_iter()
                .map(|s| {
                    let origin = segments[s.block];
                    Segment {
                        block: origin.block,
                        start: origin.start + s.start,
                        end: origin.start + s.end,
                    }
                })
                .collect()
        })
        .collect();
    Some(mapped)
}

/// Chooses column count and scale for the request. See the module documentation.
pub fn fit_layout(request: &FitRequest) -> FitLayout {
    let request = &FitRequest {
        width: request.width.max(100.0),
        height: request.height.max(100.0),
        min_scale: request.min_scale.clamp(0.3, 4.0),
        max_scale: request
            .max_scale
            .clamp(request.min_scale.clamp(0.3, 4.0), 6.0),
        header: request.header.clamp(0.0, request.height.max(100.0) * 0.6),
        ..request.clone()
    };
    let counts: Vec<usize> = column_counts(request).collect();
    // Page budget: the fewest pages any column count reaches at the smallest readable size.
    let budget = counts
        .iter()
        .filter_map(|&k| pages_at(request, k, request.min_scale))
        .min();
    let range = (request.min_scale, request.max_scale);
    let mut candidates = Vec::new();
    if let Some(budget) = budget {
        for &k in &counts {
            for policy in POLICIES {
                if let Some(scale) = largest_scale(request, k, budget, range, policy) {
                    let packing = pack(&configured(request, k, scale, policy), None)
                        .expect("scale was feasible");
                    candidates.push((k, scale, packing, policy));
                }
            }
        }
    }
    // Prefer layouts with no wrapped lines while they stay comfortably readable.
    let comfort = request
        .comfort_scale
        .clamp(request.min_scale, request.max_scale);
    if candidates
        .iter()
        .any(|c| !c.3.allow_wrap && c.1 >= comfort - 1e-9)
    {
        candidates.retain(|c| !c.3.allow_wrap);
    }
    // Within the readability band prefer whole sections, then no wraps, then fewer columns.
    let best_scale = candidates.iter().map(|c| c.1).fold(0.0, f64::max);
    let chosen = candidates
        .into_iter()
        .filter(|c| c.1 >= best_scale * SCALE_BAND)
        .min_by(|a, b| {
            a.3.dense
                .cmp(&b.3.dense)
                .then(a.2.wrapped.cmp(&b.2.wrapped))
                .then(a.0.cmp(&b.0))
        })
        .map(|(k, scale, packing, _)| (k, scale, packing));
    match chosen {
        Some((columns, scale, packing)) => {
            let wrapped_lines = packing.wrapped;
            let overflow = packing.pages > 1;
            let column_width = geometry(request, columns, scale).column_width;
            FitLayout {
                scale,
                columns,
                column_width,
                pages: paginate(request, columns, scale, packing),
                wrapped_lines,
                overflow,
            }
        }
        // Only non-wrapping lines too wide for any layout: single column at the minimum size,
        // letting those rows scroll horizontally.
        None => {
            let relaxed = FitRequest {
                blocks: request
                    .blocks
                    .iter()
                    .map(|b| FitBlock {
                        lines: b
                            .lines
                            .iter()
                            .map(|l| FitLine {
                                nowrap: false,
                                ..l.clone()
                            })
                            .collect(),
                        ..b.clone()
                    })
                    .collect(),
                ..request.clone()
            };
            let packing = pack(&geometry(&relaxed, 1, request.min_scale), None)
                .expect("wrapping lines always pack");
            FitLayout {
                scale: request.min_scale,
                columns: 1,
                column_width: relaxed.width,
                overflow: packing.pages > 1,
                wrapped_lines: packing.wrapped,
                pages: paginate(&relaxed, 1, request.min_scale, packing),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lines(count: usize, width: f64) -> Vec<FitLine> {
        (0..count)
            .map(|_| FitLine {
                width,
                height: 50.0,
                nowrap: false,
            })
            .collect()
    }

    fn block(count: usize, width: f64) -> FitBlock {
        FitBlock {
            lines: lines(count, width),
            overhead: 10.0,
            indent: 0.0,
            heading: true,
        }
    }

    fn request(blocks: Vec<FitBlock>, width: f64, height: f64) -> FitRequest {
        FitRequest {
            blocks,
            width,
            height,
            gap: 20.0,
            ..FitRequest::default()
        }
    }

    fn placed_lines(layout: &FitLayout) -> Vec<(usize, usize)> {
        let mut seen = Vec::new();
        for page in &layout.pages {
            for column in page {
                for s in column {
                    for line in s.start..s.end {
                        seen.push((s.block, line));
                    }
                }
            }
        }
        seen
    }

    #[test]
    fn short_song_grows_to_the_largest_scale_that_fits_one_page() {
        let layout = fit_layout(&request(vec![block(4, 200.0)], 1000.0, 800.0));
        assert!(!layout.overflow);
        assert_eq!(layout.pages.len(), 1);
        // 4 lines * 50 * s + 10 <= 800 and width 200 * s <= column => s limited by max_scale.
        assert!((layout.scale - 2.4).abs() < 1e-6, "{}", layout.scale);
    }

    #[test]
    fn long_song_on_a_wide_screen_uses_columns_instead_of_scrolling() {
        let blocks = (0..6).map(|_| block(8, 260.0)).collect();
        let layout = fit_layout(&request(blocks, 1400.0, 800.0));
        assert!(!layout.overflow, "should fit on one screen");
        assert!(layout.columns >= 2, "columns {}", layout.columns);
        assert!(layout.scale >= 0.8);
    }

    #[test]
    fn phone_width_stays_single_column_and_paginates_when_needed() {
        let blocks = (0..10).map(|_| block(10, 300.0)).collect();
        let layout = fit_layout(&request(blocks, 360.0, 640.0));
        assert_eq!(layout.columns, 1);
        assert!(layout.overflow);
        assert!(layout.pages.len() > 1);
        assert!((layout.scale - 0.8).abs() < 0.01 || layout.scale > 0.8);
    }

    #[test]
    fn every_line_is_placed_exactly_once_in_reading_order() {
        let blocks: Vec<FitBlock> = (0..7)
            .map(|i| block(3 + i, 180.0 + i as f64 * 30.0))
            .collect();
        let expected: Vec<(usize, usize)> = blocks
            .iter()
            .enumerate()
            .flat_map(|(b, block)| (0..block.lines.len()).map(move |l| (b, l)))
            .collect();
        for (width, height) in [
            (1400.0, 800.0),
            (900.0, 700.0),
            (390.0, 640.0),
            (2000.0, 400.0),
        ] {
            let layout = fit_layout(&request(blocks.clone(), width, height));
            assert_eq!(placed_lines(&layout), expected, "{width}x{height}");
        }
    }

    #[test]
    fn page_count_is_minimised_before_font_size() {
        let blocks: Vec<FitBlock> = (0..12).map(|_| block(6, 240.0)).collect();
        let req = request(blocks, 1200.0, 700.0);
        let layout = fit_layout(&req);
        let fewest = column_counts(&req)
            .filter_map(|k| pages_at(&req, k, req.min_scale))
            .min()
            .unwrap();
        assert_eq!(layout.pages.len(), fewest);
    }

    #[test]
    fn headings_are_not_stranded_at_the_bottom_of_a_column() {
        let blocks = vec![block(9, 100.0), block(6, 100.0), block(6, 100.0)];
        let layout = fit_layout(&FitRequest {
            max_scale: 1.0,
            min_scale: 1.0,
            ..request(blocks, 300.0, 600.0)
        });
        for page in &layout.pages {
            for column in page {
                if let Some(last) = column.last() {
                    assert!(
                        !(last.start == 0 && last.end == 1),
                        "heading alone: {last:?}"
                    );
                }
            }
        }
    }

    #[test]
    fn wrapped_lines_are_counted_and_avoided_when_a_close_alternative_exists() {
        // One very long line forces wrapping in narrow columns.
        let mut first = block(4, 200.0);
        first.lines[1].width = 900.0;
        let layout = fit_layout(&request(vec![first, block(4, 200.0)], 1000.0, 900.0));
        assert_eq!(
            layout.wrapped_lines, 0,
            "single wide column avoids wrapping"
        );
        assert_eq!(layout.columns, 1);
    }

    #[test]
    fn wraps_only_when_avoiding_it_would_drop_below_comfortable_size() {
        let mut first = block(4, 200.0);
        first.lines[1].width = 3000.0;
        let layout = fit_layout(&request(vec![first], 1000.0, 900.0));
        // Unwrapped would need scale 0.33, below comfort 1.0, so wrapping is accepted.
        assert!(layout.wrapped_lines > 0);
        assert!(layout.scale >= 1.0);
    }

    #[test]
    fn nowrap_tab_lines_shrink_the_scale_rather_than_overflow_width() {
        let mut tab = block(3, 100.0);
        tab.lines[2] = FitLine {
            width: 700.0,
            height: 40.0,
            nowrap: true,
        };
        let layout = fit_layout(&request(vec![tab], 800.0, 900.0));
        assert!(700.0 * layout.scale <= layout.column_width + EPSILON);
        assert_eq!(layout.wrapped_lines, 0);
    }

    #[test]
    fn impossible_nowrap_lines_fall_back_to_single_column_minimum_scale() {
        let mut tab = block(2, 100.0);
        tab.lines[1] = FitLine {
            width: 5000.0,
            height: 40.0,
            nowrap: true,
        };
        let layout = fit_layout(&request(vec![tab], 400.0, 600.0));
        assert_eq!(layout.columns, 1);
        assert!((layout.scale - 0.8).abs() < 1e-9);
    }

    #[test]
    fn last_page_columns_are_balanced() {
        let blocks: Vec<FitBlock> = (0..8).map(|_| block(2, 120.0)).collect();
        let layout = fit_layout(&FitRequest {
            min_scale: 1.0,
            max_scale: 1.0,
            ..request(blocks, 1000.0, 2000.0)
        });
        assert_eq!(layout.pages.len(), 1);
        let counts: Vec<usize> = layout.pages[0]
            .iter()
            .map(|c| c.iter().map(|s| s.end - s.start).sum())
            .collect();
        let max = *counts.iter().max().unwrap();
        let min = *counts.iter().min().unwrap();
        assert!(max - min <= 2, "unbalanced {counts:?}");
    }

    #[test]
    fn splits_sections_only_when_it_saves_a_page() {
        // Three 5-line sections on pages that hold 8 lines: whole sections need 3 pages,
        // splitting them needs only 2.
        let blocks: Vec<FitBlock> = (0..3)
            .map(|_| FitBlock {
                lines: lines(5, 100.0),
                overhead: 0.0,
                indent: 0.0,
                heading: false,
            })
            .collect();
        let req = FitRequest {
            min_scale: 1.0,
            max_scale: 1.0,
            max_columns: 1,
            ..request(blocks, 400.0, 400.0)
        };
        let layout = fit_layout(&req);
        // 15 lines * 50px = 750px over 400px pages: 2 pages when splitting, 3 when kept whole.
        assert_eq!(layout.pages.len(), 2);
        assert_eq!(placed_lines(&layout).len(), 15);

        // When keeping sections whole costs no extra page, they stay whole.
        let roomy = fit_layout(&FitRequest {
            height: 800.0,
            ..req
        });
        assert_eq!(roomy.pages.len(), 1);
        let segments: usize = roomy.pages[0].iter().map(Vec::len).sum();
        assert_eq!(segments, 3);
    }

    #[test]
    fn empty_song_produces_one_empty_page() {
        let layout = fit_layout(&request(Vec::new(), 800.0, 600.0));
        assert_eq!(layout.pages.len(), 1);
        assert!(!layout.overflow);
    }
}
