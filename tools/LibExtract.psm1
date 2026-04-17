# MapSave PAK Extractor Library
# Function library for PAK extraction and texture conversion.

function Expand-PakFile {
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
    
    # Method 3: Full extraction
    if (-not $found -or $found.Count -eq 0) {
        Write-Host "  Filtered extract unavailable, extracting full PAK..." -ForegroundColor DarkGray
        & $PakInspectorPath extract $Pak.FullName $TempDir 2>&1 | Out-Null
        $found = Get-ChildItem $TempDir -Recurse -Filter $targetName -ErrorAction SilentlyContinue
    }
    
    return $found
}

function Expand-FullPak {
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
    Write-Host ""
    Write-Host "  Convert .edds to:" -ForegroundColor Cyan
    Write-Host "  [1] PNG  (recommended)"
    Write-Host "  [2] TIF"
    Write-Host "  [3] DDS"
    Write-Host "  [4] Raw  (no conversion)"
    $choice = Read-Host "Choose [default: 1]"
    switch ($choice) {
        "2" { return "tif" }
        "3" { return "dds" }
        "4" { return "raw" }
        default { return "png" }
    }
}

function Convert-EddsToImage {
    param(
        [string]$EddsFilePath,
        [string]$Edds2ImagePath,
        [string]$PreferredFormat = "png"
    )
    if ($PreferredFormat -eq "raw") { return $EddsFilePath }
    
    $dir = [System.IO.Path]::GetDirectoryName($EddsFilePath)
    $name = [System.IO.Path]::GetFileName($EddsFilePath)
    
    Push-Location $dir
    & $Edds2ImagePath $name 2>&1 | Out-Null
    Pop-Location
    
    $targetExt = ".$PreferredFormat"
    $match = Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Extension -eq $targetExt } | Select-Object -First 1
    if ($match) { return $match.FullName }
    
    $fallback = Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Where-Object {
        $_.Extension -match "\.(png|tif|dds|tga|jpg)$"
    } | Select-Object -First 1
    return if ($fallback) { $fallback.FullName } else { $null }
}

function Save-ToOutput {
    param(
        [string]$SourcePath,
        [string]$DesiredName,
        [string]$OutputDir
    )
    $ext = [System.IO.Path]::GetExtension($SourcePath)
    $finalOutput = Join-Path $OutputDir "$DesiredName$ext"
    $counter = 1
    while (Test-Path $finalOutput) {
        $finalOutput = Join-Path $OutputDir "${DesiredName}_${counter}$ext"
        $counter++
    }
    Copy-Item $SourcePath $finalOutput -Recurse -Force
    return $finalOutput
}

function Invoke-ExtractedFileProcess {
    param(
        [string]$FilePath,
        [string]$OutputDir,
        [string]$Edds2ImagePath,
        [string]$EddsFormat = "png"
    )
    if ((Get-Item $FilePath) -is [System.IO.DirectoryInfo]) {
        $dirName = Split-Path $FilePath -Leaf
        $finalTargetDir = Join-Path $OutputDir $dirName
        New-Item -ItemType Directory -Force -Path $finalTargetDir | Out-Null
        
        Get-ChildItem $FilePath -Recurse -File | ForEach-Object {
            $childBase = [System.IO.Path]::GetFileNameWithoutExtension($_.FullName)
            if ($_.Extension.ToLower() -eq ".edds") {
                $img = Convert-EddsToImage -EddsFilePath $_.FullName -Edds2ImagePath $Edds2ImagePath -PreferredFormat $EddsFormat
                if ($img) { Save-ToOutput -SourcePath $img -DesiredName $childBase -OutputDir $finalTargetDir | Out-Null }
            } else {
                Save-ToOutput -SourcePath $_.FullName -DesiredName $childBase -OutputDir $finalTargetDir | Out-Null
            }
        }
        return $finalTargetDir
    }
    
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
    if ([System.IO.Path]::GetExtension($FilePath).ToLower() -eq ".edds") {
        $imagePath = Convert-EddsToImage -EddsFilePath $FilePath -Edds2ImagePath $Edds2ImagePath -PreferredFormat $EddsFormat
        return if ($imagePath) { Save-ToOutput -SourcePath $imagePath -DesiredName $baseName -OutputDir $OutputDir } else { $null }
    }
    return Save-ToOutput -SourcePath $FilePath -DesiredName $baseName -OutputDir $OutputDir
}

function Invoke-SearchMode {
    param(
        [array]$PakFiles,
        [string]$TempDir,
        [string]$OutputDir,
        [string]$PakInspectorPath,
        [string]$Edds2ImagePath
    )
    
    $searchTerm = Read-Host "Search term (e.g. 'M4A1', 'Arland', 'Tree', '.smap')"
    if ([string]::IsNullOrWhiteSpace($searchTerm)) { return }
    
    $searchPattern = [regex]::Escape($searchTerm)
    Write-Host "Scanning PAK files for '$searchTerm'..." -ForegroundColor Yellow
    
    $allMatches = @()
    foreach ($pak in $PakFiles) {
        $inspectOutput = & $PakInspectorPath inspect $pak.FullName 2>&1
        if ($inspectOutput -match $searchPattern) {
            foreach ($line in ($inspectOutput -split "`r`n")) {
                if ($line -match $searchPattern -and $line -notmatch "^\.\.\.") {
                    $cleanPath = $line.Trim()
                    if ($cleanPath.Contains("  ")) { $cleanPath = ($cleanPath -split '\s+')[0] }
                    $allMatches += [PSCustomObject]@{ Pak = $pak; Path = $cleanPath; FileName = [System.IO.Path]::GetFileName($cleanPath) }
                }
            }
        }
    }
    
    if ($allMatches.Count -eq 0) { Write-Host "No matches found." -ForegroundColor Red; return }
    
    $selection = 1
    if ($allMatches.Count -gt 1) {
        $uniqueMatches = $allMatches | Sort-Object Path -Unique
        Write-Host "Found $($uniqueMatches.Count) matches:" -ForegroundColor Cyan
        for ($i=0; $i -lt $uniqueMatches.Count; $i++) { Write-Host "  [$($i+1)] $($uniqueMatches[$i].Path)" }
        $selection = Read-Host "Select (1-$($uniqueMatches.Count))"
    }
    
    $sel = if ($allMatches.Count -eq 1) { $allMatches[0] } else { $uniqueMatches[$selection-1] }
    $foundPath = $sel.Path.Replace("\", "/")
    
    $eddsFormat = if ([System.IO.Path]::GetExtension($foundPath).ToLower() -eq ".edds") { Get-EddsFormatChoice } else { "png" }
    
    Write-Host "Extracting..." -ForegroundColor Yellow
    $extracted = Expand-PakFile -Pak $sel.Pak -InternalPath $foundPath -TempDir $TempDir -PakInspectorPath $PakInspectorPath
    if (-not $extracted) { Write-Host "Extraction failed." -ForegroundColor Red; return }
    
    $result = Invoke-ExtractedFileProcess -FilePath $extracted[0].FullName -OutputDir $OutputDir -Edds2ImagePath $Edds2ImagePath -EddsFormat $eddsFormat
    if ($result) { Write-Host "SUCCESS! -> $result" -ForegroundColor Green }
}

function Invoke-BulkExtractCore {
    param(
        [array]$PakFiles,
        [string]$TempDir,
        [string]$OutputDir,
        [string]$PakInspectorPath,
        [string]$Edds2ImagePath,
        [string]$ExtensionFilter,
        [bool]$ConvertEdds,
        [string]$EddsFormat
    )
    
    $totalProcessed = 0
    foreach ($pak in $PakFiles) {
        Write-Host "Extracting: $($pak.Name)..." -ForegroundColor Cyan
        Expand-FullPak -Pak $pak -TempDir $TempDir -PakInspectorPath $PakInspectorPath
        $files = if ($ExtensionFilter) { Get-ChildItem $TempDir -Recurse -Filter "*$ExtensionFilter" } else { Get-ChildItem $TempDir -Recurse -File }
        
        $current = 0
        foreach ($file in $files) {
            $current++; $pct = [math]::Round(($current / $files.Count) * 100)
            Write-Host "`r  Processing: $current/$($files.Count) ($pct%)" -NoNewline -ForegroundColor DarkGray
            
            if ($file.Extension.ToLower() -eq ".edds" -and $ConvertEdds) {
                $img = Convert-EddsToImage -EddsFilePath $file.FullName -Edds2ImagePath $Edds2ImagePath -PreferredFormat $EddsFormat
                if ($img) { Save-ToOutput -SourcePath $img -DesiredName ([System.IO.Path]::GetFileNameWithoutExtension($file.Name)) -OutputDir $OutputDir | Out-Null; $totalProcessed++ }
            } else {
                Save-ToOutput -SourcePath $file.FullName -DesiredName ([System.IO.Path]::GetFileNameWithoutExtension($file.Name)) -OutputDir $OutputDir | Out-Null; $totalProcessed++
            }
        }
        Write-Host ""
    }
    Write-Host "Done! Processed: $totalProcessed" -ForegroundColor Green
}

Export-ModuleMember -Function Expand-PakFile, Expand-FullPak, Get-EddsFormatChoice, Convert-EddsToImage, Save-ToOutput, Invoke-ExtractedFileProcess, Invoke-SearchMode, Invoke-BulkExtractCore
