const codeInput = document.querySelector('#codeInput');
const lineNumbers = document.querySelector('#lineNumbers');
const charCount = document.querySelector('#charCount');
const reviewButton = document.querySelector('#reviewButton');
const sampleButton = document.querySelector('#sampleButton');
const languageSelect = document.querySelector('#languageSelect');
const emptyState = document.querySelector('#emptyState');
const resultsContent = document.querySelector('#resultsContent');
const resultStatus = document.querySelector('#resultStatus');
const findings = document.querySelector('#findings');
const scoreValue = document.querySelector('#scoreValue');
const scoreRing = document.querySelector('#scoreRing');
const summaryText = document.querySelector('#summaryText');
const summaryHeading = document.querySelector('#summaryHeading');

const sampleCode = `async function getUser(id) {
  const response = await fetch('/api/users/' + id);
  const data = await response.json();

  if (data) {
    console.log('User found:', data.name);
    return data;
  }
}`;

function updateEditorMeta() {
  const value = codeInput.value;
  const lines = Math.max(1, value.split('\n').length);
  lineNumbers.textContent = Array.from({ length: lines }, (_, index) => index + 1).join('\n');
  charCount.textContent = `${value.length.toLocaleString()} / 30,000`;
}

function renderFinding(finding) {
  const severity = ['critical', 'warning', 'suggestion', 'positive'].includes(finding.severity) ? finding.severity : 'suggestion';
  return `<article class="finding">
    <div class="finding-meta"><span class="severity severity-${severity}">${severity}</span><span class="finding-line">${escapeHtml(finding.line || 'General')}</span></div>
    <h3>${escapeHtml(finding.title || 'Review note')}</h3>
    <p>${escapeHtml(finding.explanation || '')}</p>
    ${finding.recommendation ? `<p class="finding-recommendation">${escapeHtml(finding.recommendation)}</p>` : ''}
  </article>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function renderReview(review) {
  const score = Math.max(0, Math.min(100, Number(review.score) || 0));
  const angle = `${score * 3.6}deg`;
  scoreValue.textContent = score;
  scoreRing.style.background = `conic-gradient(var(--green) ${angle}, #dfe7e1 ${angle})`;
  summaryHeading.textContent = score >= 85 ? 'Strong foundation.' : score >= 65 ? 'A few things to tighten.' : 'Worth another pass.';
  summaryText.textContent = review.summary || 'Here are the most important things to consider.';
  findings.innerHTML = (review.findings || []).length ? review.findings.map(renderFinding).join('') : '<p class="summary">No findings returned. The code looks clean.</p>';
  emptyState.classList.add('hidden');
  resultsContent.classList.remove('hidden');
  resultStatus.textContent = 'COMPLETE';
  resultStatus.style.color = 'var(--green)';
}

async function reviewCode() {
  if (!codeInput.value.trim()) {
    codeInput.focus();
    resultStatus.textContent = 'NEEDS CODE';
    return;
  }
  reviewButton.disabled = true;
  reviewButton.classList.add('reviewing');
  reviewButton.querySelector('.button-label').textContent = 'Reviewing';
  resultStatus.textContent = 'ANALYZING';
  resultStatus.style.color = 'var(--orange)';
  try {
    const response = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeInput.value, language: languageSelect.value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Review failed');
    renderReview(data);
  } catch (error) {
    resultStatus.textContent = 'ERROR';
    resultStatus.style.color = 'var(--red)';
    emptyState.classList.remove('hidden');
    resultsContent.classList.add('hidden');
    emptyState.querySelector('h2').textContent = 'Review unavailable';
    emptyState.querySelector('p').textContent = error.message;
  } finally {
    reviewButton.disabled = false;
    reviewButton.classList.remove('reviewing');
    reviewButton.querySelector('.button-label').textContent = 'Review code';
  }
}

codeInput.addEventListener('input', updateEditorMeta);
codeInput.addEventListener('scroll', () => { lineNumbers.scrollTop = codeInput.scrollTop; });
sampleButton.addEventListener('click', () => { codeInput.value = sampleCode; languageSelect.value = 'javascript'; updateEditorMeta(); codeInput.focus(); });
reviewButton.addEventListener('click', reviewCode);
updateEditorMeta();
