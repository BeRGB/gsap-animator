// src/utils/responsiveTables.js
export function initResponsiveTables() {
  const tables = document.querySelectorAll('.table-card .spectra-table');
  tables.forEach((table) => {
    if (table.dataset.respReady === '1') return;

    const headCells = table.querySelectorAll('thead th');
    if (!headCells.length) return;

    const labels = Array.from(headCells).map((th) => th.textContent.trim());

    table.querySelectorAll('tbody tr').forEach((tr) => {
      const cells = Array.from(tr.children);

      const rowHead = tr.querySelector('.row-head');
      if (rowHead) {
        rowHead.setAttribute('data-col', ''); // ili 'Topic'
      }

      cells.forEach((cell, i) => {
        if (cell.tagName === 'TD') {
          const labelIndex = Math.min(i + 1, labels.length - 1);
          cell.setAttribute('data-col', labels[labelIndex] || '');
        }
      });
    });

    table.dataset.respReady = '1';
  });
}
