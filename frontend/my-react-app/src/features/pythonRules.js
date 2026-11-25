// Enter is handled by Monaco's indentation engine, including its undo transaction.
export function pythonRules(actions) {
  return [
    {
      beforeText:
        /^\s*(?:(?:async\s+)?(?:def|for|with)|class|if|elif|else|while|try|except|finally|match|case)\b.*:\s*(?:#.*)?$/,
      action: { indentAction: actions.Indent },
    },
    {
      // A continued Python header can finish on a line containing just "):".
      beforeText: /^\s*[)\]}]+:\s*(?:#.*)?$/,
      action: { indentAction: actions.Indent },
    },
    {
      beforeText: /^.*[[({]\s*$/,
      afterText: /^\s*[\])}]/,
      action: { indentAction: actions.IndentOutdent },
    },
    {
      beforeText: /^.*(?:[[({]|\\)\s*$/,
      action: { indentAction: actions.Indent },
    },
    {
      beforeText: /^\s+(?:return(?:\s+[^#]*)?|break|continue|pass)\s*(?:#.*)?$/,
      action: { indentAction: actions.Outdent },
    },
  ];
}
