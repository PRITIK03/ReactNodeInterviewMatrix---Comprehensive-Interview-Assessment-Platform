import { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import {
  conf,
  language,
} from "monaco-editor/esm/vs/basic-languages/python/python";
import Worker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { pythonRules } from "./pythonRules";
self.MonacoEnvironment = { getWorker: () => new Worker() };
monaco.languages.register({ id: "python" });
monaco.languages.setMonarchTokensProvider("python", language);
monaco.languages.setLanguageConfiguration("python", {
  ...conf,
  onEnterRules: pythonRules(monaco.languages.IndentAction),
});
monaco.editor.defineTheme("matrix-petrol", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "F0C37F" },
    { token: "number", foreground: "A6DAD2" },
    { token: "string", foreground: "E5CBA2" },
    { token: "comment", foreground: "A1BFBA" },
  ],
  colors: {
    "editor.background": "#133842",
    "editor.foreground": "#ECF2EB",
    "editorLineNumber.foreground": "#9FBAB9",
    "editor.lineHighlightBackground": "#1C434D",
    "editorCursor.foreground": "#F2CA83",
  },
});
export default function PythonEditor({ initial, onChange, onSave }) {
  const host = useRef(null),
    editor = useRef(null),
    callbacks = useRef({}),
    first = useRef(initial);
  callbacks.current = { onChange, onSave };
  const [size, font] = useState(15),
    [tab, setTab] = useState(4),
    [theme, setTheme] = useState("matrix-petrol");
  useEffect(() => {
    const e = monaco.editor.create(host.current, {
      value: first.current,
      language: "python",
      automaticLayout: true,
      padding: { top: 14, bottom: 12 },
      lineNumbers: "on",
      accessibilitySupport: "auto",
      ariaLabel: "Python submission",
      minimap: { enabled: false },
      insertSpaces: true,
      detectIndentation: false,
      useTabStops: true,
      autoIndent: "advanced",
      formatOnPaste: false,
      scrollBeyondLastLine: false,
    });
    editor.current = e;
    const model = e.getModel();
    model.setEOL(monaco.editor.EndOfLineSequence.LF);
    const listener = e.onDidChangeModelContent((event) => {
      // Keep Monaco’s language state current across rapid multiline edits. Its Enter
      // command otherwise falls back to copying whitespace while tokenization catches up.
      for (const change of event.changes) {
        if (change.text.includes("\n") && model.getValueLength() <= 16000) {
          const last = Math.min(
            model.getLineCount(),
            change.range.startLineNumber + change.text.split("\n").length - 1,
          );
          monaco.editor.colorizeModelLine(model, last);
        }
      }
      callbacks.current.onChange(e.getValue());
    });
    e.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
      callbacks.current.onSave?.(),
    );
    return () => {
      listener.dispose();
      editor.current = null;
      e.dispose();
      model.dispose();
      monaco.editor.setTheme("vs");
    };
  }, []);
  useEffect(() => {
    editor.current?.updateOptions({ fontSize: size, theme });
    editor.current
      ?.getModel()
      ?.updateOptions({ tabSize: tab, insertSpaces: true });
  }, [size, tab, theme]);
  return (
    <>
      <div className="editor-toolbar">
        <strong>Python</strong>
        <label>
          Font size
          <select value={size} onChange={(e) => font(Number(e.target.value))}>
            {[13, 15, 18, 22].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Indent width
          <select value={tab} onChange={(e) => setTab(Number(e.target.value))}>
            <option>2</option>
            <option>4</option>
            <option>8</option>
          </select>
        </label>
        <label>
          Editor theme
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="matrix-petrol">Petrol</option>
            <option value="vs">Light</option>
            <option value="vs-dark">Dark</option>
            <option value="hc-black">High contrast</option>
          </select>
        </label>
      </div>
      <div className="editor" ref={host} />
      <small>
        Enter indents Python blocks automatically. Ctrl/Cmd+S saves a draft.
        Ctrl+M toggles Tab navigation.
      </small>
    </>
  );
}
