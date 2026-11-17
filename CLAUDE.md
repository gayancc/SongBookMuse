# SongBookMuse — Permanent Agent Instructions

These instructions apply to every task in this repository.

## Task
Continue the existing implementation with the highest priority on accurate planning, verified research, REA-based understanding, and complete implementation.
The installed FL Studio desktop application is the primary source of truth for functionality, appearance, component behavior, and user interaction.
Do not invent features, UI designs, behavior, or architecture.

## 1. Mandatory research & REA verification
Before modifying code:
1. Synchronize with the latest existing code and inspect the current implementation.
2. Understand the existing architecture, components, services, and implementation patterns.
3. Use the available REA (Reverse Engineering and Analysis) tools to investigate the corresponding functionality in FL Studio.
4. Inspect the actual FL Studio application installed on the current machine.
5. Run FL Studio where necessary to observe real UI appearance, component behavior, interactions, dimensions, layouts, and workflows.
6. Cross-check research findings against the actual application.
7. Distinguish verified behavior from unverified assumptions.
8. Prepare an implementation plan based only on verified knowledge.

Never assume what an FL Studio UI component looks like or how it behaves — inspect it first. Do not replace verified findings with generic design conventions.

## 2. Planning before implementation
Plan must cover: current implementation and gaps; verified FL Studio functionality and visual references; reusable components/services; required changes and dependencies; implementation sequence; final verification strategy.
Plan before substantial code changes. Once planned, implement comprehensively rather than repeatedly switching between implementation and app testing.

## 3. Desktop-first application design
THIS IS A DESKTOP APPLICATION, NOT A WEB APPLICATION (it must still compile for Android).
- Follow FL Studio's actual desktop UI appearance and behavior wherever corresponding functionality exists.
- Use desktop-oriented layouts, controls, interaction patterns, and workflows.
- No generic web dashboards, website-like cards, excessive spacing, or web-style navigation.
- Do not redesign existing components based on personal design preferences.
- Match verified FL Studio component appearance as closely as the existing technology allows.
- Reuse the existing UI framework (React + Tauri) and architecture; no new frontend framework or UI libraries without a verified technical requirement.
- Android compatibility must not compromise the desktop experience.

## 4. No unnecessary highlight borders
Remove artificial, decorative, or unnecessary highlight borders: colored outlines around panels, component highlight borders, decorative separator borders, permanently displayed focus-like outlines, web-style card borders not present in FL Studio. Do not add them to new components.
Use the actual FL Studio appearance as reference for separation, background contrast, spacing, shading, and hierarchy.
Preserve functional keyboard-focus indicators, accessibility requirements, and borders genuinely present in the verified FL Studio UI.

## 5. Implementation rules
- Follow the approved plan systematically; reuse existing code, services, controls, and patterns.
- Make only changes required by the task. No speculative features, invented properties/interactions, placeholders, or mock behavior.
- No unrelated refactoring. Maintain cross-platform compatibility.
- Complete the full implementation — no partially connected features.
- For any uncertainty, return to research and REA verification. Decisions must be evidence-based.

## 6. Application execution & Playwright policy
DO NOT run the application or Playwright after every component change.
Workflow: Research → REA Verification → Plan → Implement All Fixes → Build → One Consolidated Verification Pass → Fix Confirmed Issues.
1. Running installed FL Studio during research is encouraged.
2. During implementation, prioritize code inspection, static analysis, focused checks.
3. Do not repeatedly launch our app to inspect small UI changes.
4. Do not run Playwright after every component modification.
5. Complete all related work before full application verification.
6. Build the application once implementation is complete.
7. Run one comprehensive verification pass covering all affected functionality and UI.
8. Use Playwright only where technically appropriate for the app's actual runtime.
9. For native desktop behavior Playwright can't verify, use desktop inspection/automation.
10. Fix issues found in the consolidated pass and revalidate as needed. Don't sacrifice correctness to avoid necessary revalidation.

## 7. FL Studio visual fidelity
For every affected UI component: find the corresponding component in installed FL Studio; observe appearance and interaction; verify position, relative dimensions, spacing, colors, typography, icons, visual states; observe behavior when selected, activated, resized, or interacted with; map to the existing architecture; implement the closest achievable equivalent.
Do not rely on memory, screenshots from unrelated versions, web conventions, or imagined behavior. Direct inspection takes precedence over assumptions.

## 8. Final verification & acceptance
Verify: all required functionality implemented; components consistent with verified FL Studio reference; no unnecessary highlight borders remain; no unrequested web-style patterns; desktop layouts/interactions work; Android build compatibility preserved; no regressions; no placeholder logic or incomplete integrations; app builds successfully; implementation matches task requirements.
Do not claim functionality is verified unless it has actually been tested.

## 9. Final report
Concise report: (1) research & REA findings verified against installed FL Studio; (2) implementation completed; (3) visual fidelity; (4) verification results (build, runtime, UI, functional); (5) remaining gaps — only genuine, verified limitations. Do not report assumptions as facts.

## Non-negotiable priorities
1. Research and REA-verified knowledge.
2. Accurate implementation planning.
3. Complete, reliable implementation using existing architecture.
4. Desktop-first FL Studio UI and behavioral fidelity.
5. One consolidated application verification pass after implementation.

The goal is not something merely resembling FL Studio — it is to reproduce the verified functionality and appearance of the actual FL Studio desktop application, using the existing codebase and architecture, without assumptions, unnecessary redesign, or repetitive testing cycles.
