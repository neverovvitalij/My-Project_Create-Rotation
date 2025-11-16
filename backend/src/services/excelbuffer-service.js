const ExcelJS = require('exceljs');

class ExcelBufferService {
  /**
   * Build an XLSX buffer with:
   * - Left: main rotation by groups and up to 5 cycles
   * - Middle-right: AO-Tätigkeiten (task | employee)
   * - Far-right: Tagesrotation (task | employee), and below it Abwesend
   */
  async buildExcelBuffer(
    specialRotation,
    highPriorityRotation,
    cycleRotations,
    allWorkers,
    aoRotationQueue,
    costCenter,
    shift
  ) {
    try {
      // ---------- 1) File name and date ----------
      const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
        .replace(/(\d{4})-(\d{2})-(\d{2})/, '$3-$2-$1');
      const fileName = `rotationsplan_${tomorrowDate}.xlsx`;
      const dateFromFile = fileName.split('_')[1].split('.')[0];

      // ---------- 2) Workbook / Worksheet ----------
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Rotationplan');

      // ---------- Visual theme ----------
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
      const colorAccentSoft = 'FFEFF6FF'; // soft blue
      const colorRowAlt = 'FFF3F4F6'; // gray-100
      const colorDivider = 'FFE5E7EB'; // gray-200

      const borderThin = { style: 'thin', color: { argb: colorDivider } };
      const borderNone = { style: undefined };

      ws.properties.defaultRowHeight = 20;
      ws.views = [{ showGridLines: false }];

      // ---------- 3) Safe coercions ----------
      const cyclesArr = Array.isArray(cycleRotations) ? cycleRotations : [];
      const numCycles = cyclesArr.length;

      const hpObj = highPriorityRotation || {};
      const aoObjOrMap = aoRotationQueue || {};
      const workersArr = Array.isArray(allWorkers) ? allWorkers : [];

      // ---------- 4) Layout (columns) ----------
      // Left block: "Mitarbeiter" + up to 5 "Runde"
      const leftCycles = Math.min(numCycles, 5);
      const leftCols = 1 + leftCycles;

      // Right side: two panels (each 2 columns), with small gaps between blocks
      const gap1 = 1; // gap between left block and AO panel
      const aoCols = 2; // AO-Tätigkeiten: Aufgabe | Mitarbeiter
      const gap2 = 1; // gap between AO and Tages panel
      const tagesCols = 2; // Tagesrotation: Aufgabe | Mitarbeiter

      // Starting column indices for the two right panels
      const rightStartAO = leftCols + gap1 + 1; // first AO column
      const rightStartTages = rightStartAO + aoCols + gap2; // first Tages column

      // Total number of columns
      const totalCols = rightStartTages + tagesCols - 1;

      // ---------- 5) Title row ----------
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

      // ---------- 6) Left block: groups & cycles ----------
      let row = 2;

      // Collect names assigned to high-priority to exclude from left "pivot" list
      const hpNames = new Set(
        Object.values(hpObj)
          .map((w) => (typeof w === 'object' && w ? w.name : w))
          .filter(Boolean)
      );

      // Build a set of all names that appear in cycles (excluding HP)
      const pivot = new Set();
      for (const rot of cyclesArr) {
        Object.values(rot || {}).forEach((w) => {
          const nm = w && typeof w === 'object' ? w.name : w;
          if (nm && !hpNames.has(nm)) pivot.add(nm);
        });
      }

      // Group workers by "group", but only those present in pivot and active
      const byGroup = {};
      workersArr.forEach(({ name, group, status }) => {
        if (name && status && pivot.has(name)) {
          if (!byGroup[group]) byGroup[group] = [];
          byGroup[group].push(name);
        }
      });

      // Render groups
      const groupEntries = Object.entries(byGroup).sort(([ga], [gb]) =>
        String(ga).localeCompare(String(gb))
      );

      for (const [grp, names] of groupEntries) {
        // Group header (merged across left block)
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

        // Subheader
        const hdrRow = ws.getRow(row++);
        const headers = [
          'Mitarbeiter',
          ...Array.from({ length: leftCycles }, (_, i) => `Runde ${i + 1}`),
        ];
        headers.forEach((txt, i) => {
          const cIndex = i + 1;
          const c = hdrRow.getCell(cIndex);
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

        // Rows: employee + stations by cycle
        names.forEach((nm, idx) => {
          const wrow = ws.getRow(row++);
          // Column 1: employee name
          const cellEmp = wrow.getCell(1);
          cellEmp.value = nm;
          cellEmp.font = { ...fontBase, bold: true };
          cellEmp.alignment = {
            vertical: 'middle',
            horizontal: 'left',
            wrapText: true,
          };
          cellEmp.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colorAccentSoft },
          };
          cellEmp.border = {
            top: idx === 0 ? borderThin : borderNone,
            left: borderThin,
            bottom: borderThin,
          };

          // Cycle columns: list stations where this employee is assigned in each round
          for (let i = 0; i < leftCycles; i++) {
            const rot = cyclesArr[i] || {};
            const sts = Object.entries(rot)
              .filter(([, w]) => ((w && w.name) || w) === nm)
              .map(([st]) => st)
              .join(', ');
            const cc = wrow.getCell(i + 2);
            cc.value = sts;
            cc.font = fontBase;
            cc.alignment = {
              vertical: 'middle',
              horizontal: 'center',
              wrapText: true,
            };
            cc.fill =
              idx % 2 === 1
                ? {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: colorRowAlt },
                  }
                : undefined;
            cc.border = {
              top: idx === 0 ? borderThin : borderNone,
              bottom: borderThin,
              right: i + 2 === leftCols ? borderThin : borderNone,
            };
          }
        });

        row++; // extra gap after group block
      }

      // ---------- 7) Right side ----------
      // Helper to extract a readable name out of either object or string
      const extractName = (v) => {
        if (typeof v === 'string') return v;
        if (v && typeof v === 'object')
          return v.name ?? v.workerName ?? (v.user && v.user.name) ?? null;
        return null;
      };

      // === 7.1 AO-Tätigkeiten panel (to the right of the left block) ===
      const rawAoEntries =
        aoObjOrMap instanceof Map
          ? Array.from(aoObjOrMap.entries())
          : Object.entries(aoObjOrMap);

      // Parse "Gruppe:<num> AO:<task>" from keys
      const parseAoKey = (key) => {
        const m = String(key).match(/Gruppe:(\d+)\s+AO:(.+)/i);
        return {
          group: m ? Number(m[1]) : Number.POSITIVE_INFINITY,
          task: m ? m[2] : String(key),
        };
      };

      const aoEntries = rawAoEntries
        .map(([taskKey, v]) => {
          const name = extractName(v) ?? String(v ?? '');
          return { taskKey, name, ...parseAoKey(taskKey) };
        })
        .sort((a, b) => a.group - b.group || a.task.localeCompare(b.task));

      let aoRow = 2;
      if (aoEntries.length > 0) {
        // AO title
        const r = ws.getRow(aoRow);
        const c = r.getCell(rightStartAO);
        c.value = 'AO-Tätigkeiten';
        c.font = { ...fontBase, bold: true };
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colorBg },
        };
        c.border = { bottom: borderThin };

        // AO header
        const aoHdr = ws.getRow(aoRow + 1);
        const hEmp = aoHdr.getCell(rightStartAO);
        const hTask = aoHdr.getCell(rightStartAO + 1);
        hEmp.value = 'Mitarbeiter';
        hTask.value = 'Aufgabe';
        [hEmp, hTask].forEach((cell, idx) => {
          cell.font = { ...fontInverse, bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colorAccent },
          };
          cell.border = { top: borderThin, bottom: borderThin };
          cell.alignment = {
            vertical: 'middle',
            horizontal: idx === 0 ? 'left' : 'right',
          };
        });
        aoHdr.height = 22;

        // AO rows
        aoEntries.forEach((entry, i) => {
          const rr = ws.getRow(aoRow + 2 + i);
          const cEmp = rr.getCell(rightStartAO);
          const cTask = rr.getCell(rightStartAO + 1);

          cEmp.value = entry.name; // Mitarbeiter
          cTask.value = entry.task; // Aufgabe

          [cEmp, cTask].forEach((cell, idx) => {
            cell.font = fontBase;
            cell.alignment = {
              vertical: 'middle',
              horizontal: idx === 0 ? 'left' : 'right',
            };
            cell.border = { bottom: borderThin };
          });
        });

        aoRow = aoRow + 2 + aoEntries.length; // last occupied row in AO panel
      }

      // === 7.2 Tagesrotation panel (to the right of AO panel) ===
      // hpEntries: [name, station]; we will render as Aufgabe (station) | Mitarbeiter (name)
      const hpEntries = Object.entries(hpObj).map(([st, w]) => [
        extractName(w) || String(w || ''),
        st,
      ]);

      let tgRow = 2;

      // Panel title
      {
        const r = ws.getRow(tgRow);
        const c = r.getCell(rightStartTages);
        c.value = 'Tagesrotation';
        c.font = { ...fontBase, bold: true };
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colorBg },
        };
        c.border = { bottom: borderThin };
      }

      // NEW: blue header like AO-Tätigkeiten: Aufgabe | Mitarbeiter
      const tgHeaderRow = tgRow + 1;
      {
        const hr = ws.getRow(tgHeaderRow);
        const hEmp = hr.getCell(rightStartTages);
        const hTask = hr.getCell(rightStartTages + 1);
        hEmp.value = 'Mitarbeiter';
        hTask.value = 'Aufgabe';
        [hEmp, hTask].forEach((cell, idx) => {
          cell.font = { ...fontInverse, bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colorAccent },
          };
          cell.border = { top: borderThin, bottom: borderThin };
          cell.alignment = {
            vertical: 'middle',
            horizontal: idx === 0 ? 'left' : 'right',
          };
        });
      }

      // Entries under the header: Aufgabe (station) | Mitarbeiter (name)
      hpEntries.forEach(([nm, st], i) => {
        const rr = ws.getRow(tgHeaderRow + 1 + i);
        const cEmp = rr.getCell(rightStartTages);
        const cTask = rr.getCell(rightStartTages + 1);

        cEmp.value = nm; // Mitarbeiter
        cTask.value = st; // Aufgabe (станция)

        cEmp.font = { ...fontBase, bold: true };
        cEmp.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colorAccentSoft },
        };
        cTask.font = fontMuted;

        [cEmp, cTask].forEach((cell, idx) => {
          cell.border = { bottom: borderThin };
          cell.alignment = {
            vertical: 'middle',
            horizontal: idx === 0 ? 'left' : 'right',
          };
        });
      });

      // === 7.3 Abwesend (below Tages) ===
      const absentNames = workersArr
        .filter((w) => !w.status)
        .map((w) => w.name)
        .filter(Boolean);

      // Start below: title (tgRow) + header (tgHeaderRow) + entries (hpEntries.length) + 2 spacer lines
      const absRow0 = tgHeaderRow + hpEntries.length + 2;

      {
        const r = ws.getRow(absRow0);
        const c = r.getCell(rightStartTages);
        c.value = 'Abwesend';
        c.font = { ...fontBase, bold: true };
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colorBg },
        };
        c.border = { bottom: borderThin };
      }

      for (let i = 0; i < absentNames.length; i += 2) {
        const rr = ws.getRow(absRow0 + i / 2 + 1);
        const c1 = rr.getCell(rightStartTages);
        const c2 = rr.getCell(rightStartTages + 1);
        c1.value = absentNames[i];
        c2.value = absentNames[i + 1] || '';

        [c1, c2].forEach((cell, idx) => {
          cell.border = { bottom: borderThin };
          cell.alignment = {
            vertical: 'middle',
            horizontal: idx === 0 ? 'left' : 'right',
          };
          cell.font = fontBase;
        });
      }

      // ---------- 8) Column widths & thin outer borders ----------
      // Left block widths
      ws.getColumn(1).width = 24;
      for (let c = 2; c <= leftCols; c++) ws.getColumn(c).width = 10;

      // Gaps
      ws.getColumn(leftCols + 1).width = 2; // gap1
      ws.getColumn(rightStartTages - 1).width = 2; // gap2

      // AO panel
      ws.getColumn(rightStartAO).width = 22;
      ws.getColumn(rightStartAO + 1).width = 22;

      // Tages panel
      ws.getColumn(rightStartTages).width = 22;
      ws.getColumn(rightStartTages + 1).width = 22;

      // Auto-fit other columns (skip gaps and right panels we already sized)
      ws.columns.forEach((col, idxZero) => {
        const cIdx = idxZero + 1;
        const isGap = cIdx === leftCols + 1 || cIdx === rightStartTages - 1;
        const isAoPanel = cIdx >= rightStartAO && cIdx <= rightStartAO + 1;
        const isTagesPanel =
          cIdx >= rightStartTages && cIdx <= rightStartTages + 1;
        if (isGap || isAoPanel || isTagesPanel) return;

        let maxLen = 0;
        col.eachCell({ includeEmpty: false }, (cell) => {
          if (cell.row === 1) return;
          const len = String(cell.value ?? '').length;
          if (len > maxLen) maxLen = len;
        });
        if (!col.width || col.width < maxLen + 2) {
          col.width = Math.max(col.width || 10, Math.min(maxLen + 2, 28));
        }
      });

      // Thin outline on very left/right edges
      const lastRowNum = ws.lastRow ? ws.lastRow.number : 1;
      for (let r0 = 2; r0 <= lastRowNum; r0++) {
        // left edge
        const leftCell = ws.getCell(r0, 1);
        leftCell.border = { ...leftCell.border, left: borderThin };
        // right edge
        const rightCell = ws.getCell(r0, totalCols);
        rightCell.border = { ...rightCell.border, right: borderThin };
      }

      // ---------- 9) Save workbook ----------
      const buffer = await workbook.xlsx.writeBuffer();
      return { buffer, fileName };
    } catch (err) {
      // User-facing log MUST be in German per requirements
      console.error(
        'Fehler beim Erstellen der Excel-Datei:',
        err?.message || err
      );
      throw new Error('Error creating Excel file');
    }
  }
}

module.exports = ExcelBufferService;
