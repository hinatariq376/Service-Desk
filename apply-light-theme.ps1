# Apply Light Theme to Single File
param([string]$FilePath)

if (-not $FilePath -or -not (Test-Path $FilePath)) {
    Write-Error "Invalid file path: $FilePath"
    exit 1
}

$content = Get-Content -Path $FilePath -Raw
$original = $content

# Core background transformations
$content = $content -replace 'bg-slate-900(?![\w-])', 'bg-slate-50'
$content = $content -replace 'bg-slate-800(?![\w-])', 'bg-white'
$content = $content -replace 'bg-slate-700(?![\w-])', 'bg-slate-100'
$content = $content -replace 'bg-slate-600(?![\w-])', 'bg-slate-200'

# Border transformations
$content = $content -replace 'border-slate-700(?![\w-])', 'border-slate-200'
$content = $content -replace 'border-slate-600(?![\w-])', 'border-slate-300'
$content = $content -replace 'border-slate-500(?![\w-])', 'border-slate-300'

# Text transformations
$content = $content -replace 'text-slate-50(?![\w-])', 'text-slate-900'
$content = $content -replace 'text-slate-100(?![\w-])', 'text-slate-900'
$content = $content -replace 'text-slate-200(?![\w-])', 'text-slate-800'
$content = $content -replace 'text-slate-300(?![\w-])', 'text-slate-700'
$content = $content -replace 'text-slate-400(?![\w-])', 'text-slate-600'

# Hover backgrounds
$content = $content -replace 'hover:bg-slate-800(?![\w-])', 'hover:bg-slate-100'
$content = $content -replace 'hover:bg-slate-700(?![\w-])', 'hover:bg-slate-200'
$content = $content -replace 'hover:bg-slate-600(?![\w-])', 'hover:bg-slate-300'

# Hover text
$content = $content -replace 'hover:text-slate-200(?![\w-])', 'hover:text-slate-900'
$content = $content -replace 'hover:text-slate-300(?![\w-])', 'hover:text-slate-800'
$content = $content -replace 'hover:text-slate-400(?![\w-])', 'hover:text-slate-700'

# Hover borders
$content = $content -replace 'hover:border-slate-600(?![\w-])', 'hover:border-slate-300'
$content = $content -replace 'hover:border-slate-500(?![\w-])', 'hover:border-slate-300'

# Dividers
$content = $content -replace 'divide-slate-700(?![\w-])', 'divide-slate-200'
$content = $content -replace 'divide-slate-600(?![\w-])', 'divide-slate-300'

# Focus states
$content = $content -replace 'focus:border-slate-500(?![\w-])', 'focus:border-slate-300'

# Ring colors
$content = $content -replace 'ring-slate-600(?![\w-])', 'ring-slate-300'

# Special opacity backgrounds
$content = $content -replace 'bg-slate-700/50', 'bg-slate-50'
$content = $content -replace 'bg-slate-700/60', 'bg-slate-100'
$content = $content -replace 'bg-slate-800/20', 'bg-slate-100'
$content = $content -replace 'bg-slate-800/30', 'bg-slate-100'
$content = $content -replace 'bg-slate-800/40', 'bg-slate-50'
$content = $content -replace 'bg-slate-900/40', 'bg-slate-50'
$content = $content -replace 'bg-slate-800/70', 'bg-slate-100'
$content = $content -replace 'bg-slate-800/50', 'bg-white'
$content = $content -replace 'border-slate-600/40', 'border-slate-200'

# Backdrop overlays
$content = $content -replace 'bg-slate-950/80', 'bg-slate-900/40'

# Active/selected states in navigation
$content = $content -replace 'bg-indigo-600/20 text-indigo-300', 'bg-indigo-50 text-indigo-700'
$content = $content -replace 'bg-indigo-950/40', 'bg-indigo-50'
$content = $content -replace 'bg-indigo-950/30', 'bg-indigo-50'
$content = $content -replace 'bg-indigo-950/60', 'bg-indigo-50'
$content = $content -replace 'border-indigo-900', 'border-indigo-200'
$content = $content -replace 'border-indigo-900/30', 'border-indigo-200'
$content = $content -replace 'text-indigo-300(?![\w-])', 'text-indigo-700'

# Yellow backgrounds (internal notes)
$content = $content -replace 'bg-yellow-950/40', 'bg-yellow-50'
$content = $content -replace 'bg-yellow-950/50', 'bg-yellow-50'
$content = $content -replace 'bg-yellow-950/60', 'bg-yellow-100'
$content = $content -replace 'border-yellow-900/50', 'border-yellow-200'
$content = $content -replace 'border-yellow-900(?![\w-])', 'border-yellow-300'

# Status badge transformations
$content = $content -replace 'bg-purple-950/40', 'bg-purple-50'
$content = $content -replace 'border-purple-900', 'border-purple-200'
$content = $content -replace 'bg-emerald-950/40', 'bg-emerald-50'
$content = $content -replace 'border-emerald-900', 'border-emerald-200'
$content = $content -replace 'bg-blue-950/40', 'bg-blue-50'
$content = $content -replace 'border-blue-900', 'border-blue-200'
$content = $content -replace 'bg-amber-950/40', 'bg-amber-50'
$content = $content -replace 'border-amber-900', 'border-amber-200'
$content = $content -replace 'bg-orange-950/40', 'bg-orange-50'
$content = $content -replace 'border-orange-900', 'border-orange-200'
$content = $content -replace 'bg-red-950/40', 'bg-red-50'
$content = $content -replace 'bg-red-950/50', 'bg-red-50'
$content = $content -replace 'border-red-900(?![\w-])', 'border-red-200'

if ($content -ne $original) {
    Set-Content -Path $FilePath -Value $content -NoNewline
    Write-Output "Updated: $FilePath"
    exit 0
} else {
    Write-Output "No changes needed: $FilePath"
    exit 0
}
