import { Widget } from '@lumino/widgets';
import { PageConfig, PathExt } from '@jupyterlab/coreutils';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

export const CommandIDs = {
  navigate: 'filetree:navigate',

  toggle: 'filetree:toggle',

  refresh: 'filetree:refresh',

  select: 'filetree:select',

  set_context: 'filetree:set-context',

  rename: 'filetree:rename',

  create_folder: 'filetree:create-folder',

  create_file: 'filetree:create-file',

  delete_op: 'filetree:delete',

  download: 'filetree:download',

  upload: 'filetree:upload',

  move: 'filetree:move',

  copy_path: 'filetree:copy_path'
};

export const Patterns = {
  tree: new RegExp(`^${PageConfig.getOption('treeUrl')}([^?]+)`),
  workspace: new RegExp(
    `^${PageConfig.getOption('workspacesUrl')}[^?/]+/tree/([^?]+)`
  )
};

export function switchView(mode: any) {
  if (mode === 'none') {
    return '';
  } else {
    return 'none';
  }
}

export function fileSizeString(fileBytes: number) {
  if (fileBytes === null) {
    return '';
  }
  if (fileBytes < 1024) {
    return fileBytes + ' B';
  }

  let i = -1;
  const byteUnits = [' KB', ' MB', ' GB', ' TB'];
  do {
    fileBytes = fileBytes / 1024;
    i++;
  } while (fileBytes > 1024);

  return Math.max(fileBytes, 0.1).toFixed(1) + byteUnits[i];
}

export function writeZipFile(zip: JSZip, path: string) {
  zip.generateAsync({ type: 'blob' }).then(content => {
    saveAs(content, PathExt.basename(path));
  });
}

export function doRename(text: HTMLElement, edit: HTMLInputElement) {
  const parent = text.parentElement;
  parent.replaceChild(edit, text);
  edit.focus();
  const index = edit.value.lastIndexOf('.');
  if (index === -1) {
    edit.setSelectionRange(0, edit.value.length);
  } else {
    edit.setSelectionRange(0, index);
  }
  // handle enter
  return new Promise<string>(resolve => {
    edit.onblur = () => {
      parent.replaceChild(text, edit);
      resolve(edit.value);
    };
    edit.onkeydown = (event: KeyboardEvent) => {
      switch (event.keyCode) {
        case 13: // Enter
          event.stopPropagation();
          event.preventDefault();
          edit.blur();
          break;
        case 27: // Escape
          event.stopPropagation();
          event.preventDefault();
          edit.blur();
          break;
        case 38: // Up arrow
          event.stopPropagation();
          event.preventDefault();
          if (edit.selectionStart !== edit.selectionEnd) {
            edit.selectionStart = edit.selectionEnd = 0;
          }
          break;
        case 40: // Down arrow
          event.stopPropagation();
          event.preventDefault();
          if (edit.selectionStart !== edit.selectionEnd) {
            edit.selectionStart = edit.selectionEnd = edit.value.length;
          }
          break;
        default:
          break;
      }
    };
  });
}

export function createOpenNode(): HTMLElement {
  const body = document.createElement('div');
  const existingLabel = document.createElement('label');
  existingLabel.textContent = 'File Path:';

  const input = document.createElement('input');
  input.value = '';
  input.placeholder = '/path/to/file';

  body.appendChild(existingLabel);
  body.appendChild(input);
  return body;
}

export class OpenDirectWidget extends Widget {
  public constructor() {
    super({ node: createOpenNode() });
  }

  public getValue(): string {
    return this.inputNode.value;
  }

  public get inputNode(): HTMLInputElement {
    return this.node.getElementsByTagName('input')[0];
  }
}
