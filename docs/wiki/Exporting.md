# Exporting

## Current export formats

| Format | Label in app | Use |
| --- | --- | --- |
| Script export | `EnfusionScript (.c)` | Direct code export for script-driven zone logic |
| Overlay image | `Image Overlay (.png)` | Transparent overlay output |
| JSON export | `JSON Config` | Portable exported configuration |
| Workbench export | `Workbench Plugin (.c)` | Script-based Workbench workflow |

## Enfusion Workbench coordinates

The editor uses the same ground-plane convention as Enfusion Workbench:

- `X` increases to the right/east
- `Z` increases upward/north on the map
- `Y` is elevation and is exported as `0` for 2D zones
- World Origin (`X`, `Z`) is the bottom-left map coordinate
- Map Scale is measured in metres per pixel
- Map Calibration accepts the terrain's world size in metres; it is saved per map dimensions and restored automatically the next time the same map loads

The live cursor readout, selected-zone data, snapping grid, EnfusionScript export, JSON export, and Workbench export all use the same calibrated transform. The Reforger grid automatically shows and snaps to 1 km squares when zoomed out, then switches to 100 m squares when zoomed in; 1 km lines remain emphasized at the detailed level.

## Exact zone placement

Select a drawn circle, rectangle, line, or polygon and open **Exact Coordinates** in the Zone Inspector. Enter Workbench X/Z values in metres, then choose **Pin to Coordinates**. Circle radius and rectangle dimensions are also entered in metres, so a circle can be placed at `X 1191.721`, `Z 1448.443` with a `1000 m` radius without estimating against the image.

The Workbench Transformation panel shows coords as X, Y, Z where **Y is elevation** (height above ground). When copying a position from Workbench, take the **X** and **Z** values and ignore Y.

## Typical export workflow

1. Finish zone placement and styling
2. Open Export
3. Choose the output format
4. Review coordinate settings
5. Generate and export
