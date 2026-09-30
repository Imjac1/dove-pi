# axi jailer host - the mechanism half of Plane B enforcement.
#
# WHY A SEPARATE HELPER INSTEAD OF NODE CODE
#   Creating a restricted token and launching a process under it needs Win32 (CreateRestrictedToken,
#   CreateProcessAsUser). Node has no built-in FFI, and this project's boundary must not live behind a
#   third-party native binding. So the *mechanism* is this file and the *policy* (which paths, which SID,
#   when to refuse) is TypeScript, where it is testable. Swapping the mechanism later does not move the policy.
#
# WHY A FILE PROTOCOL INSTEAD OF STDOUT
#   Under the DSH sandbox this repository runs in, a process cannot capture another process's output through
#   pipes (EPERM on named pipes). Therefore: request in a file, result in a file, nothing on stdout.
#
# WHAT IT PROVIDES
#   verb=probe  create the restricted token, read the restricting SID list back, report it
#   verb=run    create the restricted token, CreateProcessAsUser the command, wait, report the exit code
#
# SELF-CHECK IS PART OF THE CONTRACT
#   CreateRestrictedToken returning true does NOT mean the restriction took effect. Every result carries
#   `selfCheck` (pass | empty-list | mismatch) and the raw bytes of the readback, because "the list came back
#   empty" is the reading that gets mistaken for "it blocked".
#
# ASCII only: a mangled non-ASCII string inside a script is a silent way to lose a run.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $Request,
    [Parameter(Mandatory = $true)][string] $Result
)

$ErrorActionPreference = 'Stop'

function Write-Result([hashtable] $Payload) {
    $json = $Payload | ConvertTo-Json -Depth 6
    [System.IO.File]::WriteAllText($Result, $json, (New-Object System.Text.UTF8Encoding($false)))
}

$csSource = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.Principal;

public static class AxiJailer
{
    public const uint TOKEN_ALL_ACCESS = 0x000F01FF;
    public const uint DISABLE_MAX_PRIVILEGE = 0x1;
    public const int TokenRestrictedSids = 11;

    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern bool OpenProcessToken(IntPtr processHandle, uint desiredAccess, out IntPtr tokenHandle);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CreateRestrictedToken(IntPtr existingToken, uint flags,
        uint disableSidCount, IntPtr sidsToDisable,
        uint deletePrivilegeCount, IntPtr privilegesToDelete,
        uint restrictedSidCount, IntPtr sidsToRestrict,
        out IntPtr newTokenHandle);

    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern bool GetTokenInformation(IntPtr tokenHandle, int infoClass,
        IntPtr info, int infoLength, out int returnLength);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CreateProcessAsUser(IntPtr token, string applicationName, string commandLine,
        IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint creationFlags,
        IntPtr environment, string currentDirectory, ref STARTUPINFO startupInfo,
        out PROCESS_INFORMATION processInformation);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool TerminateProcess(IntPtr process, uint exitCode);

    [StructLayout(LayoutKind.Sequential)]
    public struct SID_AND_ATTRIBUTES { public IntPtr Sid; public uint Attributes; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct STARTUPINFO
    {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX; public int dwY; public int dwXSize; public int dwYSize;
        public int dwXCountChars; public int dwYCountChars; public int dwFillAttribute; public int dwFlags;
        public short wShowWindow; public short cbReserved2;
        public IntPtr lpReserved2; public IntPtr hStdInput; public IntPtr hStdOutput; public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_INFORMATION { public IntPtr hProcess; public IntPtr hThread; public int dwProcessId; public int dwThreadId; }

    public static IntPtr Own(out int error)
    {
        IntPtr own;
        bool ok = OpenProcessToken(System.Diagnostics.Process.GetCurrentProcess().Handle, TOKEN_ALL_ACCESS, out own);
        error = Marshal.GetLastWin32Error();
        return ok ? own : IntPtr.Zero;
    }

    static IntPtr BuildSidArray(string[] sids)
    {
        if (sids == null || sids.Length == 0) { return IntPtr.Zero; }
        int size = Marshal.SizeOf(typeof(SID_AND_ATTRIBUTES));
        IntPtr arr = Marshal.AllocHGlobal(size * sids.Length);
        for (int i = 0; i < sids.Length; i++)
        {
            SecurityIdentifier sid = new SecurityIdentifier(sids[i]);
            byte[] bytes = new byte[sid.BinaryLength];
            sid.GetBinaryForm(bytes, 0);
            IntPtr p = Marshal.AllocHGlobal(bytes.Length);
            Marshal.Copy(bytes, 0, p, bytes.Length);
            SID_AND_ATTRIBUTES sa = new SID_AND_ATTRIBUTES();
            sa.Sid = p;
            sa.Attributes = 0;
            Marshal.StructureToPtr(sa, (IntPtr)((long)arr + i * size), false);
        }
        return arr;
    }

    public static IntPtr MakeRestricted(IntPtr own, string[] restrictSids, out int error, out string diag)
    {
        IntPtr arr = BuildSidArray(restrictSids);
        IntPtr token;
        bool ok = CreateRestrictedToken(own, DISABLE_MAX_PRIVILEGE, 0, IntPtr.Zero, 0, IntPtr.Zero,
            (uint)restrictSids.Length, arr, out token);
        error = Marshal.GetLastWin32Error();
        diag = "CreateRestrictedToken(restrict=[" + string.Join(",", restrictSids) + "])=" + (ok ? "true" : "false");
        return ok ? token : IntPtr.Zero;
    }

    // Buffer-internal reads only. An earlier round dereferenced a guessed pointer and lost the whole run to
    // an AccessViolationException, which is uncatchable in .NET 4+. The layout is derived from the bytes:
    //   { DWORD GroupCount; SID_AND_ATTRIBUTES entries[16 bytes each]; SID payloads inline }
    // with entries starting at offset 8 and the payload at 8 + 16*count.
    public static string[] RestrictingSids(IntPtr token, out string raw, out int error)
    {
        List<string> sids = new List<string>();
        raw = "";
        int need = 0;
        GetTokenInformation(token, TokenRestrictedSids, IntPtr.Zero, 0, out need);
        error = Marshal.GetLastWin32Error();
        if (need <= 0) { return sids.ToArray(); }

        IntPtr buf = Marshal.AllocHGlobal(need + 64);
        int got = 0;
        bool ok = GetTokenInformation(token, TokenRestrictedSids, buf, need, out got);
        error = Marshal.GetLastWin32Error();
        if (!ok) { Marshal.FreeHGlobal(buf); return sids.ToArray(); }

        int n = got < 96 ? got : 96;
        for (int i = 0; i < n; i++) { raw += Marshal.ReadByte(buf, i).ToString("X2"); }

        if (got >= 8)
        {
            int count = Marshal.ReadInt32(buf, 0);
            int off = 8 + 16 * count;
            for (int i = 0; i < count; i++)
            {
                if (off + 8 > got) { break; }
                int rev = Marshal.ReadByte(buf, off);
                int subCount = Marshal.ReadByte(buf, off + 1);
                int sidLen = 8 + 4 * subCount;
                if (off + sidLen > got) { break; }
                ulong auth = 0;
                for (int k = 0; k < 6; k++) { auth = (auth << 8) | (ulong)Marshal.ReadByte(buf, off + 2 + k); }
                string s = "S-" + rev + "-" + auth;
                for (int k = 0; k < subCount; k++) { s += "-" + Marshal.ReadInt32(buf, off + 8 + 4 * k); }
                sids.Add(s);
                off += sidLen;
            }
        }
        Marshal.FreeHGlobal(buf);
        return sids.ToArray();
    }

    public static int Run(IntPtr token, string commandLine, string cwd, int timeoutMs, out uint exitCode, out int pid)
    {
        STARTUPINFO si = new STARTUPINFO();
        si.cb = Marshal.SizeOf(typeof(STARTUPINFO));
        PROCESS_INFORMATION pi;
        bool ok = CreateProcessAsUser(token, null, commandLine, IntPtr.Zero, IntPtr.Zero, false, 0,
            IntPtr.Zero, cwd, ref si, out pi);
        int err = Marshal.GetLastWin32Error();
        if (!ok) { exitCode = 0xFFFFFFFF; pid = 0; return err; }
        pid = pi.dwProcessId;
        uint waited = WaitForSingleObject(pi.hProcess, (uint)timeoutMs);
        if (waited != 0)
        {
            TerminateProcess(pi.hProcess, 1);
            exitCode = 0xFFFFFFFE;
        }
        else
        {
            GetExitCodeProcess(pi.hProcess, out exitCode);
        }
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);
        return 0;
    }
}
'@

try {
    $req = Get-Content -LiteralPath $Request -Raw -Encoding UTF8 | ConvertFrom-Json
    $verb = [string]$req.verb
    $restrict = @($req.restrictSids)
    $timeoutMs = 60000
    if ($req.timeoutMs) { $timeoutMs = [int]$req.timeoutMs }

    # acl-read needs no token: it is a structured read of the access rules, so the caller never parses the
    # localised text that `icacls` prints. Setting the rules stays in TypeScript (icacls exit code only).
    if ($verb -eq 'acl-read') {
        $rules = New-Object System.Collections.Generic.List[hashtable]
        foreach ($p in @($req.paths)) {
            if (-not (Test-Path -LiteralPath $p)) {
                $rules.Add(@{ path = [string]$p; missing = $true })
                continue
            }
            $acl = Get-Acl -LiteralPath $p
            foreach ($ace in $acl.Access) {
                $sid = ''
                try { $sid = $ace.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value } catch { $sid = '' }
                $rules.Add(@{
                    path     = [string]$p
                    identity = $ace.IdentityReference.Value
                    sid      = $sid
                    rights   = $ace.FileSystemRights.ToString()
                    type     = $ace.AccessControlType.ToString()
                    inherited = $ace.IsInherited
                })
            }
        }
        Write-Result @{ ok = $true; verb = 'acl-read'; rules = @($rules) }
        exit 0
    }

    Add-Type -TypeDefinition $csSource -Language CSharp

    $ownErr = 0
    $own = [AxiJailer]::Own([ref]$ownErr)
    if ($own -eq [IntPtr]::Zero) {
        Write-Result @{ ok = $false; stage = 'OpenProcessToken'; error = $ownErr }
        exit 3
    }

    $err = 0
    $diag = ''
    $token = [AxiJailer]::MakeRestricted($own, $restrict, [ref]$err, [ref]$diag)
    if ($token -eq [IntPtr]::Zero) {
        Write-Result @{ ok = $false; stage = 'CreateRestrictedToken'; error = $err; diag = $diag }
        exit 4
    }

    $raw = ''
    $readErr = 0
    $sids = @([AxiJailer]::RestrictingSids($token, [ref]$raw, [ref]$readErr))
    $expected = @($restrict | Sort-Object)
    $actual = @($sids | Sort-Object)
    $selfCheck = 'pass'
    if ($sids.Count -eq 0) { $selfCheck = 'empty-list' }
    elseif (($actual -join ',') -ne ($expected -join ',')) { $selfCheck = 'mismatch' }

    $out = @{
        ok               = $true
        verb             = $verb
        diag             = $diag
        restrictingSids  = $sids
        restrictingRaw   = $raw
        expectedSids     = $expected
        selfCheck        = $selfCheck
        readLengthQuery  = $readErr   # 122 = ERROR_INSUFFICIENT_BUFFER from the length query: expected, not a fault
        elevated         = ([System.Security.Principal.WindowsIdentity]::GetCurrent()).Owner.Value
    }

    if ($verb -eq 'run') {
        $code = [uint32]0
        # NOT `$pid`: that is a read-only automatic variable in PowerShell, and assigning to it aborts the
        # whole helper (measured: "Cannot overwrite variable PID because it is read-only or constant").
        $childPid = 0
        $runErr = [AxiJailer]::Run($token, [string]$req.command, [string]$req.cwd, $timeoutMs, [ref]$code, [ref]$childPid)
        $out['createProcessError'] = $runErr
        $out['exitCode'] = [int64]$code
        $out['pid'] = $childPid
    }

    Write-Result $out
    exit 0
}
catch {
    Write-Result @{ ok = $false; stage = 'exception'; message = $_.Exception.Message }
    exit 5
}
