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

      // === Modern theme ===
      const fontBase = {
        name: 'Segoe UI',
        size: 11,
        color: { argb: 'FF111827' },
      }; // gray-900
      const fontMuted = {
        name: 'Segoe UI',
        size: 10,
        color: { argb: 'FF6B7280' },
      }; // gray-500
      const fontInverse = {
        name: 'Segoe UI',
        size: 11,
        color: { argb: 'FFFFFFFF' },
      };

      const colorBg = 'FFF9FAFB'; // gray-50
      const colorHeader = 'FF111827'; // gray-900
      const colorAccent = 'FF2563EB'; // blue-600
      const colorAccentSoft = 'FFEFF6FF'; // soft blue bg
      const colorRowAlt = 'FFF3F4F6'; // gray-100
      const colorDivider = 'FFE5E7EB'; // gray-200

      const borderThin = { style: 'thin', color: { argb: colorDivider } };
      const borderNone = { style: undefined };

      ws.properties.defaultRowHeight = 20;
      ws.views = [{ showGridLines: false }];
      ws.eachRow((r) => (r.font = fontBase));

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
      titleCell.font = { ...fontInverse, bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colorHeader },
      };

      const dateCell = ws.getCell(1, totalCols);
      dateCell.value = dateFromFile;
      dateCell.font = { ...fontInverse, bold: true, size: 12 };
      dateCell.alignment = { horizontal: 'right', vertical: 'middle' };
      dateCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colorHeader },
      };

      ws.getRow(1).height = 34;
      ws.getRow(1).eachCell((cell, col) => {
        cell.border = {
          top: borderNone,
          left:
            col === 1
              ? { style: 'thin', color: { argb: colorHeader } }
              : borderNone,
          bottom: { style: 'thin', color: { argb: colorHeader } },
          right:
            col === totalCols
              ? { style: 'thin', color: { argb: colorHeader } }
              : borderNone,
        };
      });

      // 6) Left part: groups
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
        gcell.font = { ...fontBase, bold: true };
        gcell.alignment = { vertical: 'middle' };
        gcell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colorAccentSoft },
        };
        ws.getRow(row).height = 24;
        ws.getRow(row).eachCell((cell, col) => {
          cell.border = {
            top: { style: 'thin', color: { argb: colorAccent } },
            left:
              col === 1
                ? { style: 'thin', color: { argb: colorAccent } }
                : borderNone,
            bottom: { style: 'thin', color: { argb: colorAccent } },
            right:
              col === leftCols
                ? { style: 'thin', color: { argb: colorAccent } }
                : borderNone,
          };
        });
        row++;

        // subheader
        const hdrRow = ws.getRow(row++);
        const headers = [
          'Mitarbeiter',
          ...Array.from({ length: leftCycles }, (_, i) => `Runde ${i + 1}`),
        ];
        headers.forEach((txt, i) => {
          const c = hdrRow.getCell(i + 1);
          c.value = txt;
          c.font = { ...fontInverse, bold: true };
          c.alignment = {
            horizontal: i === 0 ? 'left' : 'center',
            vertical: 'middle',
          };
          c.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colorAccent },
          };
          c.border = {
            top: borderThin,
            left: i === 0 ? borderThin : borderNone,
            bottom: borderThin,
            right: i === headers.length - 1 ? borderThin : borderNone,
          };
        });
        hdrRow.height = 22;

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
            cell.font = fontBase;
            cell.alignment = {
              vertical: 'middle',
              horizontal: col === 1 ? 'left' : 'center',
              wrapText: true,
            };
            cell.fill =
              idx % 2 === 1
                ? {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: colorRowAlt },
                  }
                : undefined;

            cell.border = {
              top: idx === 0 ? borderThin : borderNone,
              left: col === 1 ? borderThin : borderNone,
              bottom: borderThin,
              right: col === leftCols ? borderThin : borderNone,
            };

            if (col === 1) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: colorAccentSoft },
              };
              cell.font = { ...fontBase, bold: true };
            }
          });
        });

        row++;
      }

      // 7) Right part: High Priority, Sonder, Abwesend
      const hpEntries = Object.entries(highPriorityRotation || {}).map(
        ([st, w]) => [typeof w === 'object' ? w.name : w, st]
      );
      const hpRow0 = 2;

      // header «Tagesrotation»
      ws.getRow(hpRow0).getCell(rightStart).value = 'Tagesrotation';
      ws.getRow(hpRow0).getCell(rightStart).font = { ...fontBase, bold: true };
      ws.getRow(hpRow0).getCell(rightStart).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colorBg },
      };
      ws.getRow(hpRow0).getCell(rightStart).border = { bottom: borderThin };

      // entries
      hpEntries.forEach(([nm, st], i) => {
        const r = hpRow0 + i + 1;
        const rowHP = ws.getRow(r);
        rowHP.getCell(rightStart).value = nm;
        rowHP.getCell(rightStart + 1).value = st;

        rowHP.getCell(rightStart).font = { ...fontBase, bold: true };
        rowHP.getCell(rightStart).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colorAccentSoft },
        };
        rowHP.getCell(rightStart + 1).font = fontMuted;

        [rightStart, rightStart + 1].forEach((c) => {
          ws.getCell(r, c).border = { bottom: borderThin };
          ws.getCell(r, c).alignment = {
            vertical: 'middle',
            horizontal: c === rightStart ? 'left' : 'right',
          };
        });
      });

      // 7.2 Sondertätigkeiten
      const srEntries = Object.entries(specialRotation || {}).map(
        ([nm, spec]) => [nm, typeof spec === 'object' ? spec.job : spec]
      );
      const ztkRow0 = hpRow0 + hpEntries.length + 2;
      ws.getRow(ztkRow0).getCell(rightStart).value = 'Sondertätigkeiten';
      ws.getRow(ztkRow0).getCell(rightStart).font = { ...fontBase, bold: true };
      ws.getRow(ztkRow0).getCell(rightStart).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colorBg },
      };
      ws.getRow(ztkRow0).getCell(rightStart).border = { bottom: borderThin };

      srEntries.forEach(([nm, job], i) => {
        const r = ztkRow0 + i + 1;
        const rowZ = ws.getRow(r);
        rowZ.getCell(rightStart).value = nm;
        rowZ.getCell(rightStart + 1).value = job;

        rowZ.getCell(rightStart).font = fontBase;
        rowZ.getCell(rightStart + 1).font = fontMuted;

        [rightStart, rightStart + 1].forEach((c) => {
          ws.getCell(r, c).border = { bottom: borderThin };
          ws.getCell(r, c).alignment = {
            vertical: 'middle',
            horizontal: c === rightStart ? 'left' : 'right',
          };
        });
      });

      // 7.3 Abwesend
      const absent = allWorkers.filter((w) => !w.status).map((w) => w.name);
      const absRow0 = ztkRow0 + srEntries.length + 2;
      ws.getRow(absRow0).getCell(rightStart).value = 'Abwesend';
      ws.getRow(absRow0).getCell(rightStart).font = { ...fontBase, bold: true };
      ws.getRow(absRow0).getCell(rightStart).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colorBg },
      };
      ws.getRow(absRow0).getCell(rightStart).border = { bottom: borderThin };

      for (let i = 0; i < absent.length; i += 2) {
        const r = absRow0 + i / 2 + 1;
        const rowA = ws.getRow(r);
        rowA.getCell(rightStart).value = absent[i];
        rowA.getCell(rightStart + 1).value = absent[i + 1] || '';

        [rightStart, rightStart + 1].forEach((c) => {
          const cell = ws.getCell(r, c);
          cell.border = { bottom: borderThin };
          cell.alignment = {
            vertical: 'middle',
            horizontal: c === rightStart ? 'left' : 'right',
          };
        });
      }

      // 8) Columns & subtle outline
      ws.getColumn(1).width = 24;
      for (let c = 2; c <= leftCols; c++) ws.getColumn(c).width = 10;
      ws.getColumn(leftCols + 1).width = 2;
      for (let c = rightStart; c <= totalCols; c++) ws.getColumn(c).width = 20;

      ws.columns.forEach((col, idx) => {
        if (idx + 1 === leftCols + 1) return;
        let max = 0;
        col.eachCell({ includeEmpty: false }, (cell) => {
          if (cell.row === 1) return;
          max = Math.max(max, String(cell.value || '').length);
        });
        col.width = Math.max(col.width || 10, Math.min(max + 2, 28));
      });

      const last = ws.lastRow.number;
      for (let r0 = 2; r0 <= last; r0++) {
        for (let c0 = 1; c0 <= totalCols; c0++) {
          if (c0 === 1)
            ws.getCell(r0, c0).border = {
              ...ws.getCell(r0, c0).border,
              left: borderThin,
            };
          if (c0 === totalCols)
            ws.getCell(r0, c0).border = {
              ...ws.getCell(r0, c0).border,
              right: borderThin,
            };
        }
      }

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
