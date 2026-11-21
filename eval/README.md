# Kuraso Evaluation Benchmark (`eval/`)

This directory defines Kuraso's open evaluation benchmarks (without redistributing copyrighted PDFs):

1. **200-Paper Layout & Structure Test Set (`papers-manifest.json`):**
   - Covers arXiv (single & two-column), IEEE, ACM, Springer, Elsevier, theses, French/Arabic papers, rotated pages (`90°`/`270°`), CropBox ≠ MediaBox, and scanned PDFs.
   - Target in v0.1: `>= 85%` heading detection accuracy.
2. **100-Paper AI Grounding Benchmark (Phase 4):**
   - Human-written summaries and Q&A pairs across CS, biology, and social sciences (EN + FR).
   - Targets: `100%` citation validity (code-enforced), `>= 90%` citation support on strong cloud models, `>= 75%` on 7–8B local models.
