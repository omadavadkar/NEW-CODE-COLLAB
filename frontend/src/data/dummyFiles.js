export const dummyFiles = [
  {
    name: 'src',
    type: 'folder',
    children: [
      { name: 'App.jsx', type: 'file' },
      { name: 'main.jsx', type: 'file' },
      {
        name: 'components',
        type: 'folder',
        children: [
          { name: 'EditorPane.jsx', type: 'file' },
          { name: 'ChatPanel.jsx', type: 'file' }
        ]
      }
    ]
  },
  {
    name: 'backend',
    type: 'folder',
    children: [
      { name: 'app.py', type: 'file' },
      { name: 'executor.py', type: 'file' }
    ]
  }
];

export const editorTabs = [
  { id: 'main.py', name: 'main.py' },
  { id: 'main.cpp', name: 'main.cpp' },
  { id: 'Main.java', name: 'Main.java' }
];

export const activeUsers = [];
