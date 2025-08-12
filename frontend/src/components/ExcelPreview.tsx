import { useState, useImperativeHandle, forwardRef, useContext } from 'react';
import * as XLSX from 'xlsx';
import RotationPlanService from '../services/RotationPlanService';
import styles from '../styles/ExcelPreview.module.css';
import { Context } from '../index';
import { observer } from 'mobx-react-lite';
import { IRotation, IStore } from '../store/types';

export interface ExcelPreviewHandle {
  loadPreview: () => Promise<void>;
}

interface ExcelPreviewProps {
  preassigned: Array<{ worker: string; station: string }>;
  specialAssignments: Array<{ worker: string; job: string }>;
}

const ExcelPreview = forwardRef<ExcelPreviewHandle, ExcelPreviewProps>(
  ({ preassigned, specialAssignments }, ref) => {
    const [html, setHtml] = useState('');
    const { store } = useContext(Context) as { store: IStore };
    const {
      specialRotation,
      highPriorityRotation,
      cycleRotations,
      allWorkers,
    } = store.rotation as IRotation;

    const loadPreview = async () => {
      // 1) Fetch the file as a Blob
      try {
        const response = await RotationPlanService.previewExcel({
          specialRotation,
          highPriorityRotation,
          cycleRotations,
          allWorkers,
        });
        // 2) Convert Blob to ArrayBuffer
        const arrayBuffer = await response.data.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        // 3) Parse workbook from ArrayBuffer
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // 4) Generate an HTML table with Excel styling
        const htmlTable = XLSX.utils.sheet_to_html(sheet, {
          id: 'preview-table',
          editable: false,
          header: '',
          // className: 'excel-preview',
        });

        setHtml(htmlTable);
      } catch (error) {
        // store.setErrorMsg('Failed preview Excel');
        console.error('Failed preview Excel', error);
      }
    };

    useImperativeHandle(ref, () => ({ loadPreview }));
    return (
      <>
        {html && (
          <div
            className={styles.previewContainer}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
        {store.errorMsg && (
          <p className={styles.errorMessage}>{store.errorMsg}</p>
        )}
      </>
    );
  }
);

export default observer(ExcelPreview);
