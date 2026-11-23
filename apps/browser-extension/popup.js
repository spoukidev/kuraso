const DOI_RE = /\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/;
const ARXIV_RE = /arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)/i;

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url ?? "";
  const statusEl = document.getElementById("status");
  const btn = document.getElementById("sendBtn");

  const arxiv = url.match(ARXIV_RE)?.[1];
  const doi = url.match(DOI_RE)?.[1];

  if (arxiv) {
    statusEl.textContent = `Detected arXiv:${arxiv}`;
    btn.disabled = false;
    btn.onclick = () => {
      chrome.tabs.create({ url: `kuraso://open?arxiv=${encodeURIComponent(arxiv)}` });
    };
  } else if (doi) {
    statusEl.textContent = `Detected DOI: ${doi}`;
    btn.disabled = false;
    btn.onclick = () => {
      chrome.tabs.create({ url: `kuraso://open?doi=${encodeURIComponent(doi)}` });
    };
  } else {
    statusEl.textContent = "No arXiv ID or DOI detected in this URL.";
  }
});
