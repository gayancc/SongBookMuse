# Responsive layouts

| CSS viewport | Layout |
| --- | --- |
| Above 1,050 px | Library and sheet display side by side. Opening Song details adds a right panel. |
| 661–1,050 px | Narrower library, flexible score, overlay inspector. |
| At most 660 px | One task at a time. Bottom tabs switch library and song. Song actions remain near the sheet. Details open in an overlay. |
| Performance | The sheet spans the available viewport. Song stepping and display controls remain below it. |

Boundaries are based on available CSS width and apply on layout changes. Device orientation and OS safe-area behavior still require native tablet and phone verification.
