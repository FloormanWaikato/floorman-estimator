/* Shared presentation behaviour. Estimate and enquiry logic stays in each flow. */
function updateFlowProgress(step) {
  document.querySelector('.progress-track').setAttribute('aria-valuenow', step);
  document.querySelector('.progress-track').setAttribute('aria-valuetext', `Step ${step} of 5`);
  document.querySelectorAll('[data-stage]').forEach(stage => {
    const number = Number(stage.dataset.stage);
    stage.classList.toggle('complete', number < step);
    if (number === step) stage.setAttribute('aria-current', 'step');
    else stage.removeAttribute('aria-current');
  });
  const heading = document.querySelector('.step.active h2');
  heading.setAttribute('tabindex', '-1');
  heading.focus({preventScroll: true});
}

document.querySelectorAll('.single-choice').forEach(group => {
  group.querySelectorAll('[data-value]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  group.addEventListener('click', event => {
    const selected = event.target.closest('[data-value]');
    if (!selected) return;
    group.querySelectorAll('[data-value]').forEach(button => button.setAttribute('aria-pressed', String(button === selected)));
  });
});
document.getElementById('restartBtn').addEventListener('click', () => {
  document.querySelectorAll('[aria-pressed]').forEach(button => button.setAttribute('aria-pressed', 'false'));
});
