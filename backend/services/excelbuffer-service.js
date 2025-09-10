const ExcelJS = require('exceljs');

class ExcelBufferService {
  async buildExcelBuffer(
    specialRotation,
    highPriorityRotation,
    cycleRotations,
    allWorkers,
    costCenter,
    shift
  ) {
    try {
      // 1) Filename
      const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
        .replace(/(\d{4})-(\d{2})-(\d{2})/, '$3-$2-$1');
      const fileName = `rotationsplan_${tomorrowDate}.xlsx`;
      const dateFromFile = fileName.split('_')[1].split('.')[0];

      // 2) Workbook & worksheet
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Rotationplan');

      // 3) Common border style
      const border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      const fillGray = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFEFEF' },
      };
      const fillBlue = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFADD8E6' },
      };

      // 4) Layout
      const numCycles = cycleRotations.length;
      const leftCycles = Math.min(numCycles, 5);
      const leftCols = 1 + leftCycles;
      const gapCols = 1;
      const rightCols = 2;
      const totalCols = leftCols + gapCols + rightCols;
      const rightStart = leftCols + gapCols + 1;

      // 5) Title row
      ws.mergeCells(1, 1, 1, totalCols - 1);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = `Rotationsplan ${costCenter} ${shift}-Schicht`;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
      titleCell.fill = fillGray;

      const dateCell = ws.getCell(1, totalCols);
      dateCell.value = dateFromFile;
      dateCell.font = { bold: true, size: 14 };
      dateCell.alignment = { horizontal: 'right', vertical: 'middle' };
      dateCell.fill = fillGray;

      ws.getRow(1).height = 30;
      ws.getRow(1).eachCell((cell) => {
        cell.border = {
          ...border,
          bottom: { style: 'thick', color: { argb: 'FF000000' } },
        };
      });

      // 6) Left part: groups (unchanged from before)...
      let row = 2;
      const hpNames = new Set(
        Object.values(highPriorityRotation || {}).map((w) =>
          typeof w === 'object' ? w.name : w
        )
      );
      const pivot = new Set();
      cycleRotations.forEach((rot) =>
        Object.values(rot).forEach((w) => {
          const nm = typeof w === 'object' ? w.name : w;
          if (nm && !hpNames.has(nm)) pivot.add(nm);
        })
      );
      const byGroup = {};
      allWorkers.forEach(({ name, group, status }) => {
        if (pivot.has(name) && status)
          (byGroup[group] = byGroup[group] || []).push(name);
      });
      for (const [grp, names] of Object.entries(byGroup).sort((a, b) =>
        a[0].localeCompare(b[0])
      )) {
        // group header
        ws.mergeCells(row, 1, row, leftCols);
        const gcell = ws.getCell(row, 1);
        gcell.value = `Gruppe ${grp}`;
        gcell.font = { bold: true };
        gcell.border = border;
        row++;
        // subheader
        const hdrRow = ws.getRow(row++);
        [
          'Mitarbeiter',
          ...Array.from({ length: leftCycles }, (_, i) => `Runde ${i + 1}`),
        ].forEach((txt, i) => {
          const c = hdrRow.getCell(i + 1);
          c.value = txt;
          c.font = { bold: true };
          c.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFCCFFCC' },
          };
          c.border = border;
        });
        // worker rows
        names.forEach((nm, idx) => {
          const wrow = ws.getRow(row++);
          wrow.getCell(1).value = nm;
          for (let i = 0; i < leftCycles; i++) {
            const rot = cycleRotations[i] || {};
            const sts = Object.entries(rot)
              .filter(([, w]) => ((w && w.name) || w) === nm)
              .map(([st]) => st)
              .join(', ');
            wrow.getCell(i + 2).value = sts;
          }
          wrow.eachCell((cell, col) => {
            cell.border = border;
            if (col === 1)
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFCCFFCC' },
              };
            else if (idx % 2)
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' },
              };
          });
        });
        row++;
      }

      // 7) Right part: High Priority, Sonder, Abwesend all starting at row=2
      // 7.1 High Priority
      const hpEntries = Object.entries(highPriorityRotation || {}).map(
        ([st, w]) => [typeof w === 'object' ? w.name : w, st]
      );
      const hpRow0 = 2;
      // header
      ws.getRow(hpRow0).getCell(rightStart).value = 'Tagesrotation';
      ws.getRow(hpRow0).getCell(rightStart).font = { bold: true };
      ws.getRow(hpRow0).getCell(rightStart).border = border;
      // entries
      hpEntries.forEach(([nm, st], i) => {
        const r = hpRow0 + i + 1;
        const rowHP = ws.getRow(r);
        rowHP.getCell(rightStart).value = nm;
        rowHP.getCell(rightStart + 1).value = st;
        // name cell fill = light blue
        rowHP.getCell(rightStart).fill = fillBlue;
        rowHP.getCell(rightStart).border = border;
        rowHP.getCell(rightStart + 1).border = border;
        if (i % 2) {
          ws.getCell(r, rightStart + 1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' },
          };
        }
      });

      // 7.2 Sondertätigkeiten
      const srEntries = Object.entries(specialRotation || {}).map(
        ([nm, spec]) => [nm, typeof spec === 'object' ? spec.job : spec]
      );
      const ztkRow0 = hpRow0 + hpEntries.length + 2; // one blank row
      ws.getRow(ztkRow0).getCell(rightStart).value = 'Sondertätigkeiten';
      ws.getRow(ztkRow0).getCell(rightStart).font = { bold: true };
      ws.getRow(ztkRow0).getCell(rightStart).fill = fillBlue;
      ws.getRow(ztkRow0).getCell(rightStart).border = border;
      srEntries.forEach(([nm, job], i) => {
        const r = ztkRow0 + i + 1;
        const rowZ = ws.getRow(r);
        rowZ.getCell(rightStart).value = nm;
        rowZ.getCell(rightStart + 1).value = job;
        // name cell fill = light blue
        rowZ.getCell(rightStart).fill = fillBlue;
        rowZ.getCell(rightStart).border = border;
        rowZ.getCell(rightStart + 1).border = border;
        if (i % 2) {
          ws.getCell(r, rightStart + 1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' },
          };
        }
      });

      // 7.3 Abwesend
      const absent = allWorkers.filter((w) => !w.status).map((w) => w.name);
      const absRow0 = ztkRow0 + srEntries.length + 2;
      ws.getRow(absRow0).getCell(rightStart).value = 'Abwesend';
      ws.getRow(absRow0).getCell(rightStart).font = { bold: true };
      ws.getRow(absRow0).getCell(rightStart).fill = fillBlue;
      ws.getRow(absRow0).getCell(rightStart).border = border;
      for (let i = 0; i < absent.length; i += 2) {
        const r = absRow0 + i / 2 + 1;
        const rowA = ws.getRow(r);
        rowA.getCell(rightStart).value = absent[i];
        rowA.getCell(rightStart).fill = titleCell.fill;
        rowA.getCell(rightStart).border = border;
        if (absent[i + 1]) {
          rowA.getCell(rightStart + 1).value = absent[i + 1];
          rowA.getCell(rightStart + 1).border = border;
        }
      }

      // 8) Outline & column widths (unchanged)...
      const last = ws.lastRow.number;
      for (let r0 = 1; r0 <= last; r0++) {
        for (let c0 = 1; c0 <= totalCols; c0++) {
          const b = { ...border };
          if (r0 === 1) b.top = { style: 'thick', color: { argb: 'FF000000' } };
          if (r0 === last)
            b.bottom = { style: 'thick', color: { argb: 'FF000000' } };
          if (c0 === 1)
            b.left = { style: 'thick', color: { argb: 'FF000000' } };
          if (c0 === totalCols)
            b.right = { style: 'thick', color: { argb: 'FF000000' } };
          ws.getCell(r0, c0).border = b;
        }
      }
      ws.getColumn(1).width = 22;
      for (let c = 2; c <= leftCols; c++) ws.getColumn(c).width = 8;
      ws.getColumn(leftCols + 1).width = 3;
      for (let c = rightStart; c <= totalCols; c++) ws.getColumn(c).width = 20;
      ws.columns.forEach((col) => {
        let max = 0;
        col.eachCell({ includeEmpty: false }, (cell) => {
          if (cell.row === 1) return;
          max = Math.max(max, String(cell.value || '').length);
        });
        col.width = Math.max(10, Math.min(max, 20)) + 2;
      });

      // 9) Save
      const buffer = await workbook.xlsx.writeBuffer();
      return { buffer, fileName };
    } catch (err) {
      console.error('Error creating Excel file:', err);
      throw new Error('Error creating Excel file');
    }
  }
}

module.exports = ExcelBufferService;
