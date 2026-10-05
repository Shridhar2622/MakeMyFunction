// Main world bridge script running directly in the webpage context to interface with window.monaco
(function () {
  console.log('[MakeMyFunction] Main world bridge initialized in page context.');

  function getMonacoEditor() {
    if (typeof (window as any).monaco !== 'undefined' && (window as any).monaco.editor) {
      const editors = (window as any).monaco.editor.getEditors();
      if (editors && editors.length > 0) {
        return editors[0];
      }
    }
    return null;
  }

  function getMonacoModel() {
    const editor = getMonacoEditor();
    if (editor && typeof editor.getModel === 'function') {
      const model = editor.getModel();
      if (model) return model;
    }
    if (typeof (window as any).monaco !== 'undefined' && (window as any).monaco.editor) {
      const models = (window as any).monaco.editor.getModels();
      if (models && models.length > 0) {
        return models[0];
      }
    }
    return null;
  }

  function getMonacoModelLanguageId(): string {
    const model = getMonacoModel();
    if (model) {
      if (typeof model.getLanguageId === 'function') {
        return model.getLanguageId();
      }
      if (typeof model.getLanguageIdentifier === 'function') {
        const identifier = model.getLanguageIdentifier();
        if (identifier && identifier.language) {
          return identifier.language;
        }
      }
    }
    return '';
  }

  // Listen for requests from Isolated World Content Script
  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== 'MMF_CONTENT_SCRIPT') return;

    const { action, payload, requestId } = event.data;

    if (action === 'GET_SOURCE_CODE') {
      const model = getMonacoModel();
      const code = model ? model.getValue() : '';
      const languageId = getMonacoModelLanguageId();
      window.postMessage({ source: 'MMF_MAIN_WORLD', requestId, code, languageId }, '*');
    } else if (action === 'GET_CURSOR_OFFSET') {
      const editor = getMonacoEditor();
      const model = getMonacoModel();
      let offset = 0;
      if (editor && model && typeof editor.getPosition === 'function') {
        const pos = editor.getPosition();
        if (pos) {
          offset = model.getOffsetAt(pos);
        }
      }
      window.postMessage({ source: 'MMF_MAIN_WORLD', requestId, offset }, '*');
    } else if (action === 'EXECUTE_EDIT') {
      const editor = getMonacoEditor();
      const model = getMonacoModel();

      if (editor && model && payload) {
        const { startOffset, endOffset, text } = payload;
        const startPos = model.getPositionAt(startOffset);
        const endPos = model.getPositionAt(endOffset);

        const edit = {
          range: new (window as any).monaco.Range(
            startPos.lineNumber,
            startPos.column,
            endPos.lineNumber,
            endPos.column
          ),
          text: text,
          forceMoveMarkers: true
        };

        console.log('[MakeMyFunction] Executing Monaco edit at range:', startPos, endPos, 'text:', text);
        editor.executeEdits('MakeMyFunction', [edit]);
        window.postMessage({ source: 'MMF_MAIN_WORLD', requestId, success: true }, '*');
      } else {
        console.warn('[MakeMyFunction] EXECUTE_EDIT failed: missing editor/model.', {
          hasEditor: !!editor,
          hasModel: !!model
        });
        window.postMessage({ source: 'MMF_MAIN_WORLD', requestId, success: false }, '*');
      }
    }
  });

  // Watch for Monaco editor/model attachment and content changes
  let currentEditor: any = null;
  let currentModel: any = null;

  function attachChangeListener() {
    const editor = getMonacoEditor();
    const model = getMonacoModel();

    if ((editor && editor !== currentEditor) || (model && model !== currentModel)) {
      currentEditor = editor;
      currentModel = model;
      console.log('[MakeMyFunction] Monaco active editor/model attached.');

      const onContentChange = () => {
        const m = getMonacoModel();
        const code = m ? m.getValue() : '';
        const languageId = getMonacoModelLanguageId();
        window.postMessage({ source: 'MMF_MAIN_WORLD', action: 'ON_CODE_CHANGE', code, languageId }, '*');
      };

      if (editor && typeof editor.onDidChangeModelContent === 'function') {
        editor.onDidChangeModelContent(onContentChange);
      }
      if (model && typeof model.onDidChangeContent === 'function') {
        model.onDidChangeContent(onContentChange);
      }

      // Initial broadcast of current editor content
      onContentChange();
    }
  }

  setInterval(attachChangeListener, 400);
})();
