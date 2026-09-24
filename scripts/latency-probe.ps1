# TCP connect latency from this machine to AWS regional endpoints.
# DNS is resolved ONCE per host and the connect is made to the raw IP, so the
# number is transport round-trip only, not name resolution.

$targets = @(
  @{ Region = 'eu-central-1  (Frankfurt)'; Endpoints = @(
      'dynamodb.eu-central-1.amazonaws.com',
      'ec2.eu-central-1.amazonaws.com',
      's3.eu-central-1.amazonaws.com') },
  @{ Region = 'ap-southeast-1 (Singapore)'; Endpoints = @(
      'dynamodb.ap-southeast-1.amazonaws.com',
      'ec2.ap-southeast-1.amazonaws.com',
      's3.ap-southeast-1.amazonaws.com') },
  @{ Region = 'us-east-2     (Ohio, today)'; Endpoints = @(
      'dynamodb.us-east-2.amazonaws.com',
      'ec2.us-east-2.amazonaws.com',
      's3.us-east-2.amazonaws.com') }
)

$ROUNDS = 10

function Get-Median {
  param([double[]] $Values)
  $s = $Values | Sort-Object
  $n = $s.Count
  if ($n -eq 0) { return $null }
  if ($n % 2 -eq 1) { return $s[[int](($n - 1) / 2)] }
  return (($s[$n / 2 - 1] + $s[$n / 2]) / 2)
}

$summary = @()

foreach ($t in $targets) {
  $all = @()
  foreach ($h in $t.Endpoints) {
    $ip = $null
    try {
      $ip = [System.Net.Dns]::GetHostAddresses($h) |
            Where-Object { $_.AddressFamily -eq 'InterNetwork' } |
            Select-Object -First 1
    } catch { }
    if ($null -eq $ip) {
      Write-Output ("{0,-26} {1,-42} DNS FAILED" -f $t.Region, $h)
      continue
    }

    $samples = @()
    for ($i = 0; $i -lt $ROUNDS; $i++) {
      $c  = New-Object System.Net.Sockets.TcpClient
      $sw = [System.Diagnostics.Stopwatch]::StartNew()
      $ok = $false
      try {
        $task = $c.ConnectAsync($ip, 443)
        $ok = $task.Wait(5000)
      } catch { $ok = $false }
      $sw.Stop()
      try { $c.Close() } catch { }
      if ($ok) { $samples += $sw.Elapsed.TotalMilliseconds }
      Start-Sleep -Milliseconds 120
    }

    if ($samples.Count -gt 0) {
      $med = Get-Median -Values $samples
      $all += $samples
      Write-Output ("{0,-26} {1,-42} {2,-16} n={3,-3} median {4,7:N1} ms  min {5,7:N1}  max {6,7:N1}" -f `
        $t.Region, $h, $ip.IPAddressToString, $samples.Count, $med, ($samples | Measure-Object -Minimum).Minimum, ($samples | Measure-Object -Maximum).Maximum)
    } else {
      Write-Output ("{0,-26} {1,-42} ALL CONNECTS FAILED" -f $t.Region, $h)
    }
  }

  if ($all.Count -gt 0) {
    $summary += [pscustomobject]@{
      Region  = $t.Region
      Samples = $all.Count
      Median  = [math]::Round((Get-Median -Values $all), 1)
      Min     = [math]::Round((($all | Measure-Object -Minimum).Minimum), 1)
      Max     = [math]::Round((($all | Measure-Object -Maximum).Maximum), 1)
    }
  }
}

Write-Output ''
Write-Output '================ SUMMARY (all endpoints pooled per region) ================'
$summary | Sort-Object Median | Format-Table -AutoSize | Out-String -Width 200
