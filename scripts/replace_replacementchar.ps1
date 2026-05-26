$patterns = @('*.html','*.js','*.css','*.md','*.txt')
Get-ChildItem -Path . -Recurse -Include $patterns | ForEach-Object {
    $path = $_.FullName
    try {
        $text = Get-Content -Raw -Encoding UTF8 -ErrorAction Stop $path
    } catch {
        try {
            $text = Get-Content -Raw -Encoding Default -ErrorAction Stop $path
        } catch {
            Write-Output "Skip (unreadable): $path"
            return
        }
    }
    if ($text -like '*�*') {
        $new = $text -replace '�','à'
        Set-Content -Encoding UTF8 -Value $new -Path $path
        Write-Output "Converted: $path"
    }
}