# Acknowledgements and data sources

GC-viewer's interface and code were developed with assistance from ChatGPT (OpenAI Codex), under the direction of the project author.

## Scientific data

- **Gaia photometry:** ESA's Gaia mission and the Gaia Data Processing and Analysis Consortium (DPAC), Gaia DR3. [Gaia data releases](https://www.cosmos.esa.int/web/gaia/data-releases). Cluster membership and the input stellar selection are carried through from the project's globular-cluster catalogue; no new membership estimates are made by the viewer.
- **Cluster ages, global metallicities [M/H], reddening E(B−V), and true distance moduli:** the [CARMA project](https://www.oas.inaf.it/en/research/m2-en/carma-en/), introduced by Massari et al. (2023, A&A 680, A20), using the CARMA-VI catalogue snapshot dated 21 October 2026. See the project page and catalogue's paper codes for the contributing CARMA publications. The current viewer contains 72 clusters passing the existing scientific cuts.
- **RR Lyrae identifications:** the project's cross-match of the Gaia DR3 RR Lyrae catalogue, Clementini et al. (2023, A&A 674, A18), [paper](https://doi.org/10.1051/0004-6361/202243964). Cross markers retain the project's corrected Gaia coordinates in the CMD.

## Extinction and temperature relations

- Martin et al. (2024, A&A 692, A115), Tables A.1 and A.2: per-star extinction coefficients, with the existing giant/dwarf fallback. [Paper](https://www.aanda.org/articles/aa/pdf/2024/12/aa47633-23.pdf).
- Casagrande et al. (2021, MNRAS 507, 2684), Table A.1: Gaia EDR3 colour–temperature relation. [Paper](https://doi.org/10.1093/mnras/stab2304).

The prepared data preserve the source analysis's membership and photometric-quality cuts. Absolute magnitudes use CARMA distance modulus and per-star extinction; colours are dereddened. Published CARMA age and metallicity uncertainties are retained. Reddening uncertainties use the symmetric value exported by the source analysis. The data preparation timestamp, source notebook hash and excluded-cluster reasons are recorded in `data/site.json`.

Please cite the original scientific sources when using these measurements in research.
