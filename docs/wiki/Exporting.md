# Exporting

## Current export formats

| Format | Label in app | Use |
| --- | --- | --- |
| Script export | `EnfusionScript (.c)` | Direct code export for script-driven zone logic |
| Overlay image | `Image Overlay (.png)` | Transparent overlay output |
| JSON export | `JSON Config` | Portable exported configuration |
| Workbench export | `Workbench Plugin (.c)` | Script-based Workbench workflow |

## Coordinate foundation

The export modal also includes:

- Origin Offset (`X`, `Y`)
- Map Scale (`m / px`)
- Invert Y Axis
- Map Calibration entry point

Use these before exporting if your source map image and world coordinates do not already match.

## Typical export workflow

1. Finish zone placement and styling
2. Open Export
3. Choose the output format
4. Review coordinate settings
5. Generate and export
