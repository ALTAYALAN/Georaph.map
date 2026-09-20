# Transport audit

Run from the repository root with .NET 8 or later. The tool uses the application's
`DefaultConnection`, or the `ConnectionStrings__DefaultConnection` environment variable.

```powershell
dotnet run --project tools/TransportAudit
dotnet run --project tools/TransportAudit -- --test
```

The default mode reports mismatched active stop/route types. `--test` checks type
validation, reordering, invalid points, bulk conversion, and moving Kızılay's shared
stop while preserving the rest of each custom route. Test changes are rolled back.
Use a development database for tests; they obtain database locks temporarily.

Explicit maintenance options:

- `--poi-test`: tests airport POI edits, moves, code stability, seed idempotence,
  deletion preservation, and invalid category/WKT rejection in a rolled-back transaction.
- `--airports`: persists the shared airport catalog and its IATA codes. Existing
  edits and deleted records are preserved. The API also ensures this at startup.

- `--repair`: corrects the seven reviewed records; splits train/metro platforms
  without changing coordinates or route order. Refuses unreviewed mismatches.
- `--restore-metro`: restores saved geometry only for reviewed routes 1, 77 and 78
  whose current geometry matches the former spline algorithm. Keeps route 5 intact.
- `--categories`: adds missing catalog categories without changing existing ones.

Reports and pre-repair snapshots are saved under `transport-audit/`, which is
excluded from git. Maintenance operations use transactions. Successful repairs
can be verified by running the default audit again.
