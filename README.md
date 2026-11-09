# GC-viewer

An interactive CARMA age–metallicity plane linked to dereddened, absolute-magnitude Gaia CMDs for 72 globular clusters.

Select a cluster, or press Shift / use Compare multiple to compare up to three clusters. Choose Light/Dark mode and adjust CMD dot size. Pan and zoom the central plot and CMD independently.

## Online

GitHub Pages deployment: https://hyuleep.github.io/GC-viewer/

The repository root is the complete static site. Configure GitHub Pages to deploy from the `main` branch, root folder. `.nojekyll` bypasses Jekyll; no build step or backend is required.

## Local preview

Run `python3 -m http.server 8001 --bind 127.0.0.1` from this directory and open http://127.0.0.1:8001/. If that port is occupied, choose another port.

## Credits

The interface and code were developed with assistance from ChatGPT (OpenAI Codex). See [Acknowledgements and data sources](ACKNOWLEDGEMENTS.md) for Gaia/DPAC, CARMA, RR Lyrae and extinction references. Please cite the scientific sources when using the data.

This release retains the project's prepared scientific sample and corrections. Data provenance, excluded-cluster reasons and preparation date are in `data/site.json`.
