import type { LeetCodeSubmission, Solution } from '@/types';

export function injectFolderPickerDialog(
  submission: LeetCodeSubmission,
  onResolve: (folder: string | null) => void
) {
  if (document.getElementById('leetsync-prompt-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'leetsync-prompt-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 999999;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const container = document.createElement('div');
  container.style.cssText = `
    background: #1e1e2e;
    border: 1px solid #313244;
    border-radius: 16px;
    padding: 24px;
    width: 320px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    color: #cdd6f4;
    display: flex;
    flex-direction: column;
    gap: 16px;
  `;

  const title = document.createElement('h3');
  title.innerText = 'Choose Folder Layout';
  title.style.cssText = 'margin: 0; font-size: 16px; font-weight: 600; color: #f5c2e7;';
  container.appendChild(title);

  const desc = document.createElement('p');
  desc.innerText = 'This problem belongs to multiple topics. Which folder should be used?';
  desc.style.cssText = 'margin: 0; font-size: 12px; color: #a6adc8; line-height: 1.5;';
  container.appendChild(desc);

  const optionsWrapper = document.createElement('div');
  optionsWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin: 8px 0;';

  const options = (submission.topicTags || []).map(t => t.name);
  let selectedIdx = 0;
  const buttons: HTMLButtonElement[] = [];

  options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.innerText = opt;
    btn.style.cssText = `
      width: 100%;
      text-align: left;
      padding: 10px 12px;
      font-size: 13px;
      border-radius: 8px;
      border: 1px solid #313244;
      background: #181825;
      color: #cdd6f4;
      cursor: pointer;
      transition: all 0.2s;
    `;
    btn.onclick = () => {
      onResolve(opt);
      overlay.remove();
      window.removeEventListener('keydown', handleKeyDown);
    };
    optionsWrapper.appendChild(btn);
    buttons.push(btn);
  });
  container.appendChild(optionsWrapper);

  const footer = document.createElement('div');
  footer.style.cssText = 'display: flex; gap: 8px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.innerText = 'Cancel';
  cancelBtn.style.cssText = `
    flex: 1;
    padding: 8px;
    font-size: 13px;
    border-radius: 8px;
    border: 1px solid #313244;
    background: transparent;
    color: #a6adc8;
    cursor: pointer;
  `;
  cancelBtn.onclick = () => {
    onResolve(null);
    overlay.remove();
    window.removeEventListener('keydown', handleKeyDown);
  };
  footer.appendChild(cancelBtn);
  container.appendChild(footer);

  overlay.appendChild(container);
  document.body.appendChild(overlay);

  const updateFocus = () => {
    buttons.forEach((btn, i) => {
      if (i === selectedIdx) {
        btn.style.borderColor = '#89b4fa';
        btn.style.background = 'rgba(137, 180, 250, 0.1)';
      } else {
        btn.style.borderColor = '#313244';
        btn.style.background = '#181825';
      }
    });
  };
  updateFocus();

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      selectedIdx = (selectedIdx + 1) % options.length;
      updateFocus();
    } else if (e.key === 'ArrowUp') {
      selectedIdx = (selectedIdx - 1 + options.length) % options.length;
      updateFocus();
    } else if (e.key === 'Enter') {
      onResolve(options[selectedIdx]);
      overlay.remove();
      window.removeEventListener('keydown', handleKeyDown);
    } else if (e.key === 'Escape') {
      onResolve(null);
      overlay.remove();
      window.removeEventListener('keydown', handleKeyDown);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
}

export function injectConflictResolutionDialog(
  submission: LeetCodeSubmission,
  existingSolutions: Solution[],
  onResolve: (action: 'replace' | 'save_as_new', label?: string) => void
) {
  if (document.getElementById('leetsync-prompt-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'leetsync-prompt-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 999999;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const container = document.createElement('div');
  container.style.cssText = `
    background: #1e1e2e;
    border: 1px solid #313244;
    border-radius: 16px;
    padding: 24px;
    width: 320px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    color: #cdd6f4;
    display: flex;
    flex-direction: column;
    gap: 16px;
  `;

  const title = document.createElement('h3');
  title.innerText = 'Existing Solution Found';
  title.style.cssText = 'margin: 0; font-size: 16px; font-weight: 600; color: #f5c2e7;';
  container.appendChild(title);

  const desc = document.createElement('p');
  desc.innerText = 'What would you like to do with this submission?';
  desc.style.cssText = 'margin: 0; font-size: 12px; color: #a6adc8; line-height: 1.5;';
  container.appendChild(desc);

  const choicesWrapper = document.createElement('div');
  choicesWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  const actions: { name: string; action: 'replace' | 'save_as_new'; label?: string }[] = [
    { name: 'Replace Default Solution', action: 'replace' },
    { name: 'Save as Brute Force', action: 'save_as_new', label: 'Brute Force' },
    { name: 'Save as Better', action: 'save_as_new', label: 'Better' },
    { name: 'Save as Optimal', action: 'save_as_new', label: 'Optimal' },
  ];

  let selectedIdx = 0;
  const buttons: HTMLButtonElement[] = [];

  actions.forEach((act, idx) => {
    const btn = document.createElement('button');
    btn.innerText = act.name;
    btn.style.cssText = `
      width: 100%;
      text-align: left;
      padding: 10px 12px;
      font-size: 13px;
      border-radius: 8px;
      border: 1px solid #313244;
      background: #181825;
      color: #cdd6f4;
      cursor: pointer;
      transition: all 0.2s;
    `;
    btn.onclick = () => {
      onResolve(act.action, act.label);
      overlay.remove();
      window.removeEventListener('keydown', handleKeyDown);
    };
    choicesWrapper.appendChild(btn);
    buttons.push(btn);
  });
  container.appendChild(choicesWrapper);

  const footer = document.createElement('div');
  footer.style.cssText = 'display: flex; gap: 8px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.innerText = 'Cancel';
  cancelBtn.style.cssText = `
    flex: 1;
    padding: 8px;
    font-size: 13px;
    border-radius: 8px;
    border: 1px solid #313244;
    background: transparent;
    color: #a6adc8;
    cursor: pointer;
  `;
  cancelBtn.onclick = () => {
    onResolve('replace', undefined);
    overlay.remove();
    window.removeEventListener('keydown', handleKeyDown);
  };
  footer.appendChild(cancelBtn);
  container.appendChild(footer);

  overlay.appendChild(container);
  document.body.appendChild(overlay);

  const updateFocus = () => {
    buttons.forEach((btn, i) => {
      if (i === selectedIdx) {
        btn.style.borderColor = '#89b4fa';
        btn.style.background = 'rgba(137, 180, 250, 0.1)';
      } else {
        btn.style.borderColor = '#313244';
        btn.style.background = '#181825';
      }
    });
  };
  updateFocus();

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      selectedIdx = (selectedIdx + 1) % actions.length;
      updateFocus();
    } else if (e.key === 'ArrowUp') {
      selectedIdx = (selectedIdx - 1 + actions.length) % actions.length;
      updateFocus();
    } else if (e.key === 'Enter') {
      const act = actions[selectedIdx];
      onResolve(act.action, act.label);
      overlay.remove();
      window.removeEventListener('keydown', handleKeyDown);
    } else if (e.key === 'Escape') {
      onResolve('replace', undefined);
      overlay.remove();
      window.removeEventListener('keydown', handleKeyDown);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
}
