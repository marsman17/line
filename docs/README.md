# Launch and feature roadmap

`public/tableq-roadmap.pdf` is a 26-page fillable PDF. It covers launch gates, the missing feature roadmap, optional service-based estimates, documentation, and final-name clearance. Each track has checkboxes, an owner, target date, status, evidence and blockers. Save a copy after filling it in with a form-capable PDF viewer.

Download it directly from a running app at `/tableq-roadmap.pdf`. The PDF uses TableQ as the working name; suggested alternatives have not been checked for domain or trademark availability. Dates are blank so the operator can plan against staffing and launch scope.

To regenerate the PDF and its JSON planning data (optional; not needed to run the app):

```sh
python -m pip install reportlab==4.4.9
python docs/generate-roadmap.py
```

The generator uses available DejaVu/Arial fonts and falls back to standard PDF fonts. `docs/roadmap-data.json` is the generated list of tracks, dependencies, current state, tasks and completion gates. Current-state entries are snapshots; update them as work and verification progress.
