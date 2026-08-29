# PowerShell script to update zinc theme to slate theme
# Run from project root: .\update-theme.ps1

$files = Get-ChildItem -Path "src" -Recurse -Include *.tsx,*.jsx,*.ts,*.js

$replacements = @{
    # Background colors
    'bg-zinc-950' = 'bg-slate-900'
    'bg-zinc-900' = 'bg-slate-800'
    'bg-zinc-800' = 'bg-slate-700'
    'bg-zinc-700' = 'bg-slate-600'
    'bg-zinc-600' = 'bg-slate-500'
    'bg-zinc-500' = 'bg-slate-400'
    
    # Border colors
    'border-zinc-900' = 'border-slate-800'
    'border-zinc-800' = 'border-slate-700'
    'border-zinc-700' = 'border-slate-600'
    'border-zinc-600' = 'border-slate-500'
    
    # Text colors
    'text-zinc-50' = 'text-slate-50'
    'text-zinc-100' = 'text-slate-100'
    'text-zinc-200' = 'text-slate-200'
    'text-zinc-300' = 'text-slate-300'
    'text-zinc-400' = 'text-slate-400'
    'text-zinc-500' = 'text-slate-500'
    'text-zinc-600' = 'text-slate-600'
    
    # Hover states
    'hover:bg-zinc-900' = 'hover:bg-slate-800'
    'hover:bg-zinc-800' = 'hover:bg-slate-700'
    'hover:bg-zinc-700' = 'hover:bg-slate-600'
    'hover:text-zinc-200' = 'hover:text-slate-200'
    'hover:text-zinc-300' = 'hover:text-slate-300'
    'hover:border-zinc-700' = 'hover:border-slate-600'
    'hover:border-zinc-600' = 'hover:border-slate-500'
    
    # Focus states
    'focus:border-zinc-600' = 'focus:border-slate-500'
    
    # Ring colors
    'ring-zinc-700' = 'ring-slate-600'
    
    # Divide colors
    'divide-zinc-800' = 'divide-slate-700'
}

$count = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    foreach ($old in $replacements.Keys) {
        $new = $replacements[$old]
        $content = $content -replace [regex]::Escape($old), $new
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Updated: $($file.Name)" -ForegroundColor Green
        $count++
    }
}

Write-Host "`nTotal files updated: $count" -ForegroundColor Cyan
