# PowerShell script to transform dark theme to light theme
# Run from project root: .\transform-to-light.ps1

Write-Host "Starting Light Theme Transformation..." -ForegroundColor Cyan

$replacements = @{
    # Backgrounds - Core transformation
    'bg-slate-900' = 'bg-slate-50'
    'bg-slate-800' = 'bg-white'
    'bg-slate-700' = 'bg-slate-100'
    'bg-slate-600' = 'bg-slate-200'
    'bg-slate-500' = 'bg-slate-300'
    
    # Borders
    'border-slate-700' = 'border-slate-200'
    'border-slate-600' = 'border-slate-300'
    'border-slate-500' = 'border-slate-300'
    
    # Text colors - MOST IMPORTANT
    'text-slate-50' = 'text-slate-900'
    'text-slate-100' = 'text-slate-900'
    'text-slate-200' = 'text-slate-800'
    'text-slate-300' = 'text-slate-700'
    'text-slate-400' = 'text-slate-600'
    'text-slate-600' = 'text-slate-400'
    
    # Hover states - backgrounds
    'hover:bg-slate-800' = 'hover:bg-slate-100'
    'hover:bg-slate-700' = 'hover:bg-slate-200'
    'hover:bg-slate-600' = 'hover:bg-slate-300'
    
    # Hover states - text
    'hover:text-slate-200' = 'hover:text-slate-900'
    'hover:text-slate-300' = 'hover:text-slate-800'
    'hover:text-slate-400' = 'hover:text-slate-700'
    
    # Hover states - borders
    'hover:border-slate-600' = 'hover:border-slate-300'
    'hover:border-slate-500' = 'hover:border-slate-300'
    
    # Dividers
    'divide-slate-700' = 'divide-slate-200'
    'divide-slate-600' = 'divide-slate-300'
    
    # Focus states
    'focus:border-slate-500' = 'focus:border-slate-300'
    
    # Ring colors
    'ring-slate-600' = 'ring-slate-300'
    
    # Specific color transformations for message backgrounds
    'bg-slate-700/50' = 'bg-slate-50'
    'border-slate-600/40' = 'border-slate-200'
    
    # Indigo message backgrounds (darker in dark theme)
    'bg-indigo-950/30' = 'bg-indigo-50'
    'border-indigo-900/30' = 'border-indigo-200'
    
    # Yellow/Internal note backgrounds
    'bg-yellow-950/40' = 'bg-yellow-50'
    'bg-yellow-950/50' = 'bg-yellow-50'
    'bg-yellow-950/60' = 'bg-yellow-100'
    'border-yellow-900/50' = 'border-yellow-200'
    'border-yellow-900' = 'border-yellow-300'
    
    # Status badge darker backgrounds need lightening
    'bg-indigo-950/40' = 'bg-indigo-50'
    'border-indigo-900' = 'border-indigo-200'
    'bg-purple-950/40' = 'bg-purple-50'
    'border-purple-900' = 'border-purple-200'
    'bg-emerald-950/40' = 'bg-emerald-50'
    'border-emerald-900' = 'border-emerald-200'
    'bg-blue-950/40' = 'bg-blue-50'
    'border-blue-900' = 'border-blue-200'
    'bg-amber-950/40' = 'bg-amber-50'
    'border-amber-900' = 'border-amber-200'
    'bg-orange-950/40' = 'bg-orange-50'
    'border-orange-900' = 'border-orange-200'
    'bg-red-950/40' = 'bg-red-50'
    'bg-red-950/50' = 'bg-red-50'
    'border-red-900' = 'border-red-200'
    
    # Slate backgrounds with opacity
    'bg-slate-800/20' = 'bg-slate-100'
    'bg-slate-800/30' = 'bg-slate-100'
    'bg-slate-900/40' = 'bg-slate-50'
    
    # Backdrop overlays
    'bg-slate-950/80' = 'bg-slate-900/40'
    
    # Active states in sidebar
    'bg-indigo-600/20 text-indigo-300' = 'bg-indigo-50 text-indigo-700'
    
    # Hover states in sidebar/navigation
    'hover:bg-slate-800/70' = 'hover:bg-slate-100'
}

$count = 0
$files = Get-ChildItem -Path "src" -Recurse -Include *.tsx,*.jsx

Write-Host "Found $($files.Count) component files to process..." -ForegroundColor Yellow

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    foreach ($old in $replacements.Keys) {
        $new = $replacements[$old]
        $content = $content -replace [regex]::Escape($old), $new
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "  ✓ Updated: $($file.Name)" -ForegroundColor Green
        $count++
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Light Theme Transformation Complete!" -ForegroundColor Green
Write-Host "Total files updated: $count" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "" -ForegroundColor Cyan
