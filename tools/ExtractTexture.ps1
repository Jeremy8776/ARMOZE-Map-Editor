# MapSave PAK Extractor
# Main caller script for PAK extraction and texture conversion.
# Dependencies: PakInspector.exe, edds2image.exe, LibExtract.psm1

param(
    [string]$ResourcePath,
    [string]$OutputDir,
    [string]$ToolsDir,
    [string]$ScanDir,
    [string]$GameDir = "C:\Program Files (x86)\Steam\steamapps\common\Tactical Sandbox",
    [string]$OpenFolder = "1",
    [ValidateSet("png","tif","tga","dds","raw","")][string]$Format = "",
    [ValidateSet("Search","BulkAll","BulkTextures","BulkExtension")][string]$Action = "Search",
    [string]$FilterExtension = ""
)

$ToolsDir = if ($ToolsDir) { $ToolsDir } else { $PSScriptRoot }
Import-Module (Join-Path $ToolsDir "LibExtract.psm1") -Force

# --- Setup Paths ---
$pakInspector = Join-Path $ToolsDir "PakInspector.exe"
$edds2image = Join-Path $ToolsDir "edds2image.exe"
$interactiveMode = [string]::IsNullOrWhiteSpace($ResourcePath)

if ($interactiveMode) {
    if ([string]::IsNullOrWhiteSpace($ScanDir)) {
        $scanInput = Read-Host "Scan Directory [Default: $GameDir\addons\data]"
        $ScanDir = if ([string]::IsNullOrWhiteSpace($scanInput)) { Join-Path $GameDir "addons\data" } else { $scanInput }
    }

    if ([string]::IsNullOrWhiteSpace($OutputDir)) {
        $outputInput = Read-Host "Output Directory [Default: Documents\MapSave_Exports]"
        $OutputDir = if ([string]::IsNullOrWhiteSpace($outputInput)) { Join-Path ([Environment]::GetFolderPath("MyDocuments")) "MapSave_Exports" } else { $outputInput }
    }
}

# --- Derive Addon Name & Prep Folders ---
$addonName = if ((Split-Path $ScanDir -Leaf) -match '^(.+)_[0-9A-Fa-f]{8,}$') { $Matches[1] } else { Split-Path $ScanDir -Leaf }
$addonName = if ($addonName -eq "data") { "Vanilla" } else { $addonName }
$OutputDir = Join-Path $OutputDir $addonName
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$tempDir = Join-Path (Split-Path $OutputDir -Parent) "_temp_extract"

$pakFiles = if (Test-Path $ScanDir) { Get-ChildItem -Path $ScanDir -Filter "*.pak" -Recurse } else { @() }
Write-Host "Found $($pakFiles.Count) PAK file(s) for $addonName." -ForegroundColor Cyan

# --- Execution ---
if ($interactiveMode) {
    $running = $true
    while ($running) {
        $mode = Read-Host "`n[1] Search [2] Bulk Extract [3] Exit`nChoose"
        switch ($mode) {
            "1" { Invoke-SearchMode -PakFiles $pakFiles -TempDir $tempDir -OutputDir $OutputDir -PakInspectorPath $pakInspector -Edds2ImagePath $edds2image }
            "2" { 
                $fChoice = Read-Host "Extract: [1] All [2] Textures [3] By Ext [4] Cancel"
                if ($fChoice -match "[123]") {
                    $ext = switch($fChoice){ "2" {".edds"}; "3" {Read-Host "Extension"} default {$null} }
                    $conv = ($fChoice -match "[12]") -or ($ext -eq ".edds")
                    $fmt = if ($conv) { Get-EddsFormatChoice } else { "png" }
                    Invoke-BulkExtractCore -PakFiles $pakFiles -TempDir $tempDir -OutputDir $OutputDir -PakInspectorPath $pakInspector -Edds2ImagePath $edds2image -ExtensionFilter $ext -ConvertEdds $conv -EddsFormat $fmt
                }
            }
            "3" { $running = $false }
        }
    }
} else {
    # Automated Mode
    $autoFmt = if ($Format) { $Format } else { "png" }
    if ($Action -eq "Search") {
        # PakInspector colourizes its listing with ANSI escapes; strip them
        # before matching so exact paths resolve instead of silently failing.
        # ([char]27 form works on both Windows PowerShell 5.1 and PowerShell 7.)
        $ansiPattern = "$([char]27)\[[0-9;]*[mK]"
        $pakListings = foreach ($p in $pakFiles) {
            [pscustomobject]@{ Pak = $p; Listing = ((& $pakInspector inspect $p.FullName 2>&1) -join "`n") -replace $ansiPattern, "" }
        }
        $foundPak = foreach ($entry in $pakListings) {
            if ($entry.Listing -match [regex]::Escape($ResourcePath)) { $entry.Pak; break }
        }
        if (-not $foundPak) {
            Write-Host "No PAK entry matched '$ResourcePath'." -ForegroundColor Red
            exit 2
        }
        $extracted = Expand-PakFile -Pak $foundPak -InternalPath $ResourcePath.Replace("\","/") -TempDir $tempDir -PakInspectorPath $pakInspector
        if (-not $extracted -or $extracted.Count -eq 0) {
            Write-Host "Extraction produced no output for '$ResourcePath'." -ForegroundColor Red
            exit 3
        }
        $outputFile = Invoke-ExtractedFileProcess -FilePath $extracted[0].FullName -OutputDir $OutputDir -Edds2ImagePath $edds2image -EddsFormat $autoFmt
        if (-not $outputFile) {
            Write-Host "Failed to convert or save '$ResourcePath'." -ForegroundColor Red
            exit 4
        }
        Write-Host "SUCCESS! -> $outputFile"
    } else {
        $ext = switch($Action){ "BulkTextures" {".edds"}; "BulkExtension" {$FilterExtension} default {$null} }
        $conv = ($Action -match "BulkAll|BulkTextures") -or ($ext -eq ".edds")
        $bulkResult = Invoke-BulkExtractCore -PakFiles $pakFiles -TempDir $tempDir -OutputDir $OutputDir -PakInspectorPath $pakInspector -Edds2ImagePath $edds2image -ExtensionFilter $ext -ConvertEdds $conv -EddsFormat $autoFmt
        if ($bulkResult -and $bulkResult -ne 0) {
            if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
            exit $bulkResult
        }
    }
    if ($OpenFolder -eq "1") { Invoke-Item $OutputDir }
}

if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
Write-Host "Goodbye!" -ForegroundColor Gray
