# Fit-to-screen chord chart layout

**Goal.** While a musician is playing, show as much of the song as possible at the largest readable size. Scrolling is a fallback. When a song cannot fit on one screen, it becomes the fewest screen-sized pages, so one page turn (Page Down, Space, pedal, swipe) always moves exactly one screen.

## Evidence and research

- **Reference app (E18, shipped artifact).** The SongBook Pro 26.0.2 snapshot contains `ChoFitToPageOptimizer`, `_blocksToColumns`, `columnsToPage`, `getFontScaleToFitToPage`, `packColumnsRowsResult`, "Fit to page" and "Reduces the font size if lines are too long to fit". These names describe the problem: sections into columns, columns into pages, and a font scale. They do not describe an algorithm. The algorithm below is original.
- **Text fitting.** Libraries such as [textFit](https://github.com/STRML/textFit) and [auto-text-size](https://github.com/sanalabs/auto-text-size) binary-search the font size against an overflow predicate. That works because "overflows" is monotone in size.
- **Column balancing.** Splitting an ordered sequence into k contiguous parts that minimize the tallest part is the linear-partition ("split array largest sum") problem. A greedy feasibility check combined with a binary search over the cap solves it ([UW CSE 417 notes](https://courses.cs.washington.edu/courses/cse417/02wi/slides/05dp-linpart.pdf), [LinearSplit](https://hackage.haskell.org/package/LinearSplit-0.1/docs/Data-LinearSplit.html)).
- **Other apps.** OnSong documents manual levers: smaller fonts, line spacing, margins and paper size ([OnSong page layout](https://onsongapp.com/docs/page-layout)). MobileSheets offers "Auto-Size Font" for text songs ([forum](https://zubersoft.com/mobilesheets/forum/printthread.php?tid=4700)).

## Algorithm (`crates/muse-core/src/layout.rs`)

1. **Measure once.** The UI renders a hidden copy of the chart at 18 px (scale 1) with no wrapping. For every row it records the natural width (plus a 3% + 2 px safety margin) and height including margins. It also records each section's fixed chrome (padding, border, margin) and the title height. Row sizes scale linearly with the font scale. Chrome is fixed in pixels.
2. **Candidates.** Each column count k runs from 1 to 4, kept only while the column is at least 300 px wide. Each k is tried under four packing policies: sections kept whole or split freely, and wrapping allowed or not.
3. **Packing (feasibility).** Rows are placed greedily in reading order. A section stays in the current column if it fits. It moves whole to the next column if it fits there and the move wastes less than half a column. Otherwise it splits line by line. A heading is never left alone at the bottom of a column. A wrapped row counts `ceil(width / column width)` rows, and tab or grid rows may not wrap. The page count is the number of columns used divided by k.
4. **Page budget.** The budget is the fewest pages any candidate reaches at the minimum readable scale (0.78, about 14 px).
5. **Scale search.** For each candidate, a binary search finds the largest scale between 0.78 and 2.6 whose packing stays within the budget. Pages never decrease as the scale grows, so the search is exact to about 28 steps.
6. **Choice.** The order of preference is:
   - fewest pages, then
   - largest scale, keeping candidates within 8% of the best, then
   - whole sections over split ones, then
   - no wrapped rows, then
   - fewer columns.

   Unwrapped layouts are preferred whenever one exists at or above the comfortable scale (1.0). This follows the reference app's "reduce the font size if lines are too long" behavior.
7. **Balance.** The last page's columns are evened out with a binary search on the column cap and the same greedy check.
8. **Verify.** After rendering, the UI checks every column. If one overflows because of font metrics, it re-fits with that many pixels held back, up to 3 times. Lyrics are never clipped.

## Behaviour

| Situation | Result |
| --- | --- |
| Short song | One column, large type, up to 2.6× (about 47 px) |
| Long song, wide screen | Two to four balanced columns on one screen, no scroll |
| Long song, phone | One column, fewest screen-sized pages, Page Down moves exactly one page |
| Very long tab rows | Font shrinks so tabs fit; if impossible, minimum scale in one column |
| Resize, rotation, panel toggle | Re-measured and re-fit automatically |

The toolstrip "Fit song to screen" toggle and the inspector switch between fit and the fixed-zoom scroll layout. The hint bar reports the result, for example "Fit to screen: 3 columns · 83% · 1 screen".

## Tests

- **Rust** (`layout::tests`, 13 cases):
  - every line is placed exactly once and in order across viewport sizes
  - page count is minimized before font size
  - columns are used before scrolling
  - phone layouts paginate
  - headings are never stranded
  - wrap avoidance and the comfort fallback
  - tab rows shrink the font
  - the impossible-width fallback
  - the last page is balanced
  - dense packing is used only when it saves a page
  - an empty song gives one empty page
- **Windows UI** (`fits a long song…`):
  - no scrolling, no clipped column and a font of at least 14 px on desktop
  - no wrapped chord rows, with trailing chords level with the line's other chords
  - on a phone, pages are exactly one screen tall and Page Down moves one page
