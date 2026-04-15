# MapSave PAK Extractor
# Searches and extracts assets from Arma Reforger PAK files.
# Supports targeted search or bulk extraction with optional .edds conversion.
# Can be run from Workbench (automated) or manually (interactive).

param(
    [Parameter(Mandatory = $false)]
    [string]$ResourcePath,  # e.g., "UI/Textures/Map/worlds/Arland/ArlandRasterized.edds" or just "ArlandRasterized"
    
    [Parameter(Mandatory = $false)]
    [string]$OutputDir,     # e.g., "C:/Users/.../MapSave_Exports"
    
    [Parameter(Mandatory = $false)]
    [string]$ToolsDir,      # Directory containing PakInspector.exe and edds2image.exe
    
    [Parameter(Mandatory = $false)]
    [string]$ScanDir,       # Directory containing PAK files to scan. Defaults to GameDir/addons/data if empty.
    
    [string]$GameDir = "C:\Program Files (x86)\Steam\steamapps\common\Arma Reforger",
    
    [string]$OpenFolder = "1"  # "1" to open folder after export, "0" to skip
)

$ErrorActionPreference = "Continue"

# --- Setup Tools Directory ---
if (-not $ToolsDir -or -not (Test-Path (Join-Path $ToolsDir "PakInspector.exe"))) {
    if ($PSScriptRoot) {
        $ToolsDir = $PSScriptRoot
    }
    else {
        $ToolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    }
}

$pakInspector = Join-Path $ToolsDir "PakInspector.exe"
$edds2image = Join-Path $ToolsDir "edds2image.exe"

Write-Host "=== MapSave PAK Extractor ===" -ForegroundColor Cyan
Write-Host "Tools Dir: $ToolsDir" -ForegroundColor Gray

# --- Validate Tools ---
if (-not (Test-Path $pakInspector)) {
    Write-Host "ERROR: PakInspector.exe not found at: $pakInspector" -ForegroundColor Red
    Write-Host "Ensure this script is in the Tools folder with the executables."
    Read-Host "Press Enter to exit"
    exit 1
}
if (-not (Test-Path $edds2image)) {
    Write-Host "ERROR: edds2image.exe not found at: $edds2image" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# --- Interactive Mode Input ---
$interactiveMode = [string]::IsNullOrWhiteSpace($ResourcePath)

if ($interactiveMode) {
    Write-Host "Interactive Mode" -ForegroundColor Green
    Write-Host ""
    
    $defaultScan = Join-Path $GameDir "addons\data"
    Write-Host "Enter directory to scan for PAK files."
    Write-Host "Default: $defaultScan" -ForegroundColor Gray
    $inputScan = Read-Host "Scan Directory [Press Enter for Default]"
    
    if (-not [string]::IsNullOrWhiteSpace($inputScan)) {
        $ScanDir = $inputScan.Trim('"').Trim('''')
    }
    else {
        $ScanDir = $defaultScan
    }
    
    $defaultOut = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "MapSave_Exports"
    Write-Host ""
    Write-Host "Enter output directory."
    Write-Host "Default: $defaultOut" -ForegroundColor Gray
    $inputOut = Read-Host "Output Directory [Press Enter for Default]"
    
    if (-not [string]::IsNullOrWhiteSpace($inputOut)) {
        $OutputDir = $inputOut.Trim('"').Trim('''')
    }
    else {
        $OutputDir = $defaultOut
    }
}

# --- Derive Addon Name from Scan Directory ---
# Strips trailing hex hash suffixes (e.g. "Anizay_6266DCA9193C705E" -> "Anizay")
$scanLeaf = Split-Path $ScanDir -Leaf
$addonName = $scanLeaf
if ($scanLeaf -match '^(.+)_[0-9A-Fa-f]{8,}$') {
    $addonName = $Matches[1]
}
if ($addonName -eq "data") {
    $addonName = "Vanilla"
}

$OutputDir = Join-Path $OutputDir $addonName

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}

# Temp dir sits alongside the addon folder
$tempDir = Join-Path (Split-Path $OutputDir -Parent) "_temp_extract"

# --- Scan for PAKs ---
Write-Host ""
Write-Host "Addon:  $addonName" -ForegroundColor Cyan
Write-Host "Scan:   $ScanDir" -ForegroundColor Gray
Write-Host "Output: $OutputDir" -ForegroundColor Gray

if (Test-Path $ScanDir) {
    $pakFiles = Get-ChildItem -Path $ScanDir -Filter "*.pak" -Recurse
    Write-Host "Found $($pakFiles.Count) PAK file(s)." -ForegroundColor Green
}
else {
    Write-Host "WARNING: Scan directory not found!" -ForegroundColor Yellow
    $pakFiles = @()
}

# ============================================================
# Extraction Helpers
# ============================================================

function Extract-FromPak {
    # Extracts a single file from a PAK. Tries filtered first, falls back to full extraction.
    param(
        [object]$Pak,
        [string]$InternalPath,
        [string]$TempDir,
        [string]$PakInspectorPath
    )
    
    if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
    
    $targetName = [System.IO.Path]::GetFileName($InternalPath)
    
    # Method 1: Filtered extraction
    & $PakInspectorPath extract $Pak.FullName $TempDir -f $InternalPath 2>&1 | Out-Null
    $found = Get-ChildItem $TempDir -Recurse -Filter $targetName -ErrorAction SilentlyContinue
    
    # Method 2: Filtered with raw flag
    if (-not $found -or $found.Count -eq 0) {
        & $PakInspectorPath extract $Pak.FullName $TempDir -f $InternalPath -r 2>&1 | Out-Null
        $found = Get-ChildItem $TempDir -Recurse -Filter $targetName -ErrorAction SilentlyContinue
    }
    
    # Method 3: Full extraction, locate target by name
    if (-not $found -or $found.Count -eq 0) {
        Write-Host "  Filtered extract unavailable, extracting full PAK..." -ForegroundColor DarkGray
        & $PakInspectorPath extract $Pak.FullName $TempDir 2>&1 | Out-Null
        $found = Get-ChildItem $TempDir -Recurse -Filter $targetName -ErrorAction SilentlyContinue
    }
    
    return $found
}

function Extract-FullPak {
    # Extracts an entire PAK to the temp directory.
    param(
        [object]$Pak,
        [string]$TempDir,
        [string]$PakInspectorPath
    )
    
    if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
    
    & $PakInspectorPath extract $Pak.FullName $TempDir 2>&1 | Out-Null
}

function Get-EddsFormatChoice {
    # Prompts the user for their preferred .edds output format.
    # Returns: "png", "tif", "dds", or "raw"
    Write-Host ""
    Write-Host "  Convert .edds to:" -ForegroundColor Cyan
    Write-Host "  [1] PNG  (recommended)"
    Write-Host "  [2] TIF"
    Write-Host "  [3] DDS"
    Write-Host "  [4] Raw  (keep as .edds, no conversion)"
    $choice = Read-Host "Choose [default: 1]"
    
    switch ($choice) {
        "2" { return "tif" }
        "3" { return "dds" }
        "4" { return "raw" }
        default { return "png" }
    }
}

function Convert-EddsToImage {
    # Converts an .edds file and returns the path matching the preferred format, or $null.
    param(
        [string]$EddsFilePath,
        [string]$Edds2ImagePath,
        [string]$PreferredFormat = "png"  # "png", "tif", "dds", "raw"
    )
    
    # Raw mode — no conversion, return the .edds file itself
    if ($PreferredFormat -eq "raw") {
        return $EddsFilePath
    }
    
    $dir = [System.IO.Path]::GetDirectoryName($EddsFilePath)
    $name = [System.IO.Path]::GetFileName($EddsFilePath)
    
    Push-Location $dir
    & $Edds2ImagePath $name 2>&1 | Out-Null
    Pop-Location
    
    # edds2image outputs into format-named subdirectories (png/, tif/, dds/)
    $targetExt = ".$PreferredFormat"
    $match = Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Extension -eq $targetExt } | Select-Object -First 1
    
    if ($match) { return $match.FullName }
    
    # Fallback: return any converted image if preferred format wasn't produced
    $fallback = Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Where-Object {
        $_.Extension -match "\.(png|tif|dds|tga|jpg)$"
    } | Select-Object -First 1
    
    if ($fallback) { return $fallback.FullName }
    return $null
}

function Save-ToOutput {
    # Copies a file to the output folder with collision-safe naming.
    param(
        [string]$SourcePath,
        [string]$DesiredName,
        [string]$OutputDir
    )
    
    $ext = [System.IO.Path]::GetExtension($SourcePath)
    $baseOutput = Join-Path $OutputDir "$DesiredName$ext"
    $finalOutput = $baseOutput
    $counter = 1
    while (Test-Path $finalOutput) {
        $finalOutput = Join-Path $OutputDir "${DesiredName}_${counter}$ext"
        $counter++
    }
    
    Copy-Item $SourcePath $finalOutput -Force
    return $finalOutput
}

function Process-ExtractedFile {
    # Handles a single extracted file: converts .edds to chosen format, copies everything else raw.
    param(
        [string]$FilePath,
        [string]$OutputDir,
        [string]$Edds2ImagePath,
        [string]$EddsFormat = "png"  # "png", "tif", "dds", "raw"
    )
    
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
    $ext = [System.IO.Path]::GetExtension($FilePath).ToLower()
    
    if ($ext -eq ".edds") {
        $imagePath = Convert-EddsToImage -EddsFilePath $FilePath -Edds2ImagePath $Edds2ImagePath -PreferredFormat $EddsFormat
        if ($imagePath) {
            return (Save-ToOutput -SourcePath $imagePath -DesiredName $baseName -OutputDir $OutputDir)
        }
        return $null
    }
    else {
        return (Save-ToOutput -SourcePath $FilePath -DesiredName $baseName -OutputDir $OutputDir)
    }
}

# ============================================================
# Mode: Search & Extract
# ============================================================

function Invoke-SearchMode {
    param(
        [array]$PakFiles,
        [string]$TempDir,
        [string]$OutputDir,
        [string]$PakInspectorPath,
        [string]$Edds2ImagePath
    )
    
    $searchTerm = Read-Host "Search term (e.g. 'M4A1', 'Arland', 'Tree', '.smap')"
    if ([string]::IsNullOrWhiteSpace($searchTerm)) {
        Write-Host "No search term entered." -ForegroundColor Yellow
        return
    }
    
    $searchPattern = [regex]::Escape($searchTerm)
    Write-Host "Scanning PAK files for '$searchTerm'..." -ForegroundColor Yellow
    
    $allMatches = @()
    foreach ($pak in $PakFiles) {
        $inspectOutput = & $PakInspectorPath inspect $pak.FullName 2>&1
        if ($inspectOutput -match $searchPattern) {
            $lines = $inspectOutput -split "`r`n"
            foreach ($line in $lines) {
                if ($line -match $searchPattern -and $line -notmatch "^\.\.\.") {
                    $cleanPath = $line.Trim()
                    if ($cleanPath.Contains("  ")) {
                        $cleanPath = ($cleanPath -split '\s+')[0]
                    }
                    $allMatches += [PSCustomObject]@{
                        Pak      = $pak
                        Path     = $cleanPath
                        FileName = [System.IO.Path]::GetFileName($cleanPath)
                    }
                }
            }
        }
    }
    
    if ($allMatches.Count -eq 0) {
        Write-Host "No matches found for '$searchTerm'." -ForegroundColor Red
        return
    }
    
    # --- Selection ---
    $foundPak = $null
    $foundPath = $null
    
    if ($allMatches.Count -eq 1) {
        $sel = $allMatches[0]
        Write-Host "Found 1 match: $($sel.Path)" -ForegroundColor Green
        $foundPak = $sel.Pak
        $foundPath = $sel.Path
    }
    else {
        $uniqueMatches = $allMatches | Sort-Object Path -Unique
        Write-Host ""
        Write-Host "Found $($uniqueMatches.Count) matches:" -ForegroundColor Cyan
        
        $i = 1
        foreach ($m in $uniqueMatches) {
            Write-Host "  [$i] $($m.Path)  (in $($m.Pak.Name))"
            $i++
        }
        
        $selection = 0
        while ($selection -lt 1 -or $selection -gt $uniqueMatches.Count) {
            $inputStr = Read-Host "Select (1-$($uniqueMatches.Count))"
            if ([int]::TryParse($inputStr, [ref]$selection)) {
                if ($selection -lt 1 -or $selection -gt $uniqueMatches.Count) {
                    Write-Host "Invalid." -ForegroundColor Red
                }
            }
        }
        
        $sel = $uniqueMatches[$selection - 1]
        $foundPak = $sel.Pak
        $foundPath = $sel.Path
        Write-Host "Selected: $foundPath" -ForegroundColor Green
    }
    
    $foundPath = $foundPath.Replace("\", "/")
    
    # Ask format choice if the selected file is .edds
    $eddsFormat = "png"
    $selExt = [System.IO.Path]::GetExtension($foundPath).ToLower()
    if ($selExt -eq ".edds") {
        $eddsFormat = Get-EddsFormatChoice
    }
    
    Write-Host "Extracting from $($foundPak.Name)..." -ForegroundColor Yellow
    $extractedFiles = Extract-FromPak -Pak $foundPak -InternalPath $foundPath `
        -TempDir $TempDir -PakInspectorPath $PakInspectorPath
    
    if (-not $extractedFiles) {
        Write-Host "ERROR: Extraction failed." -ForegroundColor Red
        return
    }
    
    $result = Process-ExtractedFile -FilePath $extractedFiles[0].FullName `
        -OutputDir $OutputDir -Edds2ImagePath $Edds2ImagePath -EddsFormat $eddsFormat
    
    if ($result) {
        Write-Host ""
        Write-Host "SUCCESS! -> $result" -ForegroundColor Green
    }
    else {
        Write-Host "ERROR: Processing failed." -ForegroundColor Red
    }
}

# ============================================================
# Mode: Bulk Extract
# ============================================================

function Invoke-ExtractAllMode {
    param(
        [array]$PakFiles,
        [string]$TempDir,
        [string]$OutputDir,
        [string]$PakInspectorPath,
        [string]$Edds2ImagePath
    )
    
    # Let the user choose what to extract
    Write-Host ""
    Write-Host "  Extract what?" -ForegroundColor Cyan
    Write-Host "  [1] Everything          - All files from the PAK(s)"
    Write-Host "  [2] Textures (.edds)    - Extract and convert to images"
    Write-Host "  [3] By extension        - Filter by type (e.g. .et, .emat, .smap)"
    Write-Host "  [4] Cancel"
    $filterChoice = Read-Host "Choose"
    
    $extensionFilter = $null  # null = everything
    $convertEdds = $false
    $eddsFormat = "png"
    
    switch ($filterChoice) {
        "1" {
            $extensionFilter = $null
            $convertEdds = $true
            $eddsFormat = Get-EddsFormatChoice
            Write-Host "Extracting all files (.edds -> $eddsFormat)." -ForegroundColor Gray
        }
        "2" {
            $extensionFilter = ".edds"
            $convertEdds = $true
            $eddsFormat = Get-EddsFormatChoice
            Write-Host "Extracting textures only (-> $eddsFormat)." -ForegroundColor Gray
        }
        "3" {
            $extInput = Read-Host "Extension to filter (e.g. .et, .emat, .smap)"
            if ([string]::IsNullOrWhiteSpace($extInput)) {
                Write-Host "No extension entered. Cancelled." -ForegroundColor Yellow
                return
            }
            if (-not $extInput.StartsWith(".")) { $extInput = ".$extInput" }
            $extensionFilter = $extInput.ToLower()
            if ($extensionFilter -eq ".edds") {
                $convertEdds = $true
                $eddsFormat = Get-EddsFormatChoice
            }
            Write-Host "Extracting *$extensionFilter files." -ForegroundColor Gray
        }
        "4" { Write-Host "Cancelled." -ForegroundColor Gray; return }
        default { Write-Host "Invalid choice." -ForegroundColor Red; return }
    }
    
    Write-Host "From $($PakFiles.Count) PAK file(s) -> $OutputDir" -ForegroundColor Gray
    $confirm = Read-Host "Continue? (Y/N)"
    if ($confirm -notmatch "^[Yy]") {
        Write-Host "Cancelled." -ForegroundColor Gray
        return
    }
    
    $totalProcessed = 0
    $totalFailed = 0
    
    foreach ($pak in $PakFiles) {
        Write-Host ""
        Write-Host "Extracting: $($pak.Name)..." -ForegroundColor Cyan
        
        Extract-FullPak -Pak $pak -TempDir $TempDir -PakInspectorPath $PakInspectorPath
        
        # Gather files based on filter
        if ($extensionFilter) {
            $files = @(Get-ChildItem $TempDir -Recurse -Filter "*$extensionFilter" -ErrorAction SilentlyContinue)
        }
        else {
            $files = @(Get-ChildItem $TempDir -Recurse -File -ErrorAction SilentlyContinue)
        }
        
        Write-Host "  Found $($files.Count) file(s) to process." -ForegroundColor Gray
        if ($files.Count -eq 0) { continue }
        
        $current = 0
        foreach ($file in $files) {
            $current++
            $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
            $ext = $file.Extension.ToLower()
            $pct = [math]::Round(($current / $files.Count) * 100)
            Write-Host "`r  Processing: $current/$($files.Count) ($pct%) - $($file.Name)       " -NoNewline -ForegroundColor DarkGray
            
            if ($ext -eq ".edds" -and $convertEdds) {
                $imagePath = Convert-EddsToImage -EddsFilePath $file.FullName -Edds2ImagePath $Edds2ImagePath -PreferredFormat $eddsFormat
                if ($imagePath) {
                    Save-ToOutput -SourcePath $imagePath -DesiredName $baseName -OutputDir $OutputDir | Out-Null
                    $totalProcessed++
                }
                else { $totalFailed++ }
            }
            else {
                # Copy raw file as-is
                Save-ToOutput -SourcePath $file.FullName -DesiredName $baseName -OutputDir $OutputDir | Out-Null
                $totalProcessed++
            }
        }
        Write-Host ""
    }
    
    Write-Host ""
    Write-Host "Done! Processed: $totalProcessed | Failed: $totalFailed" -ForegroundColor Green
    Write-Host "Output: $OutputDir" -ForegroundColor Cyan
}

# ============================================================
# Main Loop (Interactive) / One-Shot (Automated)
# ============================================================

if ($interactiveMode) {
    $running = $true
    while ($running) {
        Write-Host ""
        Write-Host "-----------------------------------" -ForegroundColor DarkGray
        Write-Host "  [1] Search   - Find a specific file"
        Write-Host "  [2] Extract  - Bulk extract from PAK"
        Write-Host "  [3] Exit"
        Write-Host "-----------------------------------" -ForegroundColor DarkGray
        $mode = Read-Host "Choose"
        
        switch ($mode) {
            "1" {
                Invoke-SearchMode -PakFiles $pakFiles -TempDir $tempDir -OutputDir $OutputDir `
                    -PakInspectorPath $pakInspector -Edds2ImagePath $edds2image
            }
            "2" {
                Invoke-ExtractAllMode -PakFiles $pakFiles -TempDir $tempDir -OutputDir $OutputDir `
                    -PakInspectorPath $pakInspector -Edds2ImagePath $edds2image
            }
            "3" { $running = $false }
            default { Write-Host "Invalid choice." -ForegroundColor Red }
        }
    }
}
else {
    # Automated one-shot mode — uses ResourcePath directly
    $searchPattern = [regex]::Escape($ResourcePath)
    $foundPath = $ResourcePath.Replace("\", "/")
    
    $targetPak = $null
    foreach ($pak in $pakFiles) {
        $inspectOutput = & $pakInspector inspect $pak.FullName 2>&1
        if ($inspectOutput -match $searchPattern) {
            $targetPak = $pak
            break
        }
    }
    
    if (-not $targetPak) {
        Write-Host "ERROR: '$ResourcePath' not found in any PAK." -ForegroundColor Red
        exit 1
    }
    
    $extractedFiles = Extract-FromPak -Pak $targetPak -InternalPath $foundPath `
        -TempDir $tempDir -PakInspectorPath $pakInspector
    
    if (-not $extractedFiles) {
        Write-Host "ERROR: Extraction failed." -ForegroundColor Red
        exit 1
    }
    
    $result = Process-ExtractedFile -FilePath $extractedFiles[0].FullName `
        -OutputDir $OutputDir -Edds2ImagePath $edds2image
    
    if ($result) {
        Write-Host "SUCCESS! -> $result" -ForegroundColor Green
        if ($OpenFolder -eq "1") { Invoke-Item $OutputDir }
    }
    else {
        Write-Host "ERROR: Processing failed." -ForegroundColor Red
        exit 1
    }
}

# Cleanup
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Goodbye!" -ForegroundColor Gray
if ($interactiveMode) {
    Read-Host "Press Enter to close..."
}
