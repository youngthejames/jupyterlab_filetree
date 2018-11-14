import {
  JupyterLab, JupyterLabPlugin, ILayoutRestorer, IRouter
} from '@jupyterlab/application';

import {
  ContentsManager
} from '@jupyterlab/services';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  IDocumentManager, isValidFileName, renameFile
} from '@jupyterlab/docmanager';

import {
	Time, URLExt, PathExt, PageConfig
} from '@jupyterlab/coreutils';

import {
  showErrorMessage, showDialog, Dialog, Toolbar, ToolbarButton
} from '@jupyterlab/apputils';

import {
  Widget, PanelLayout
} from '@phosphor/widgets';

import {
  Uploader
} from './upload';

import '../style/index.css';

namespace CommandIDs {
  export const navigate = 'filetree:navigate';

  export const toggle = 'filetree:toggle';

  export const refresh = 'filetree:refresh';

  export const set_context = 'filetree:set-context';

  export const rename = 'filetree:rename';

  export const create_folder = 'filetree:create-folder';

  export const create_file = 'filetree:create-file';

  export const delete_op = 'filetree:delete';

  export const download = 'filetree:download';

  export const upload = 'filetree:upload';
}

namespace Patterns {

  export const tree = new RegExp(`^${PageConfig.getOption('treeUrl')}([^?]+)`);
  export const workspace = new RegExp(`^${PageConfig.getOption('workspacesUrl')}[^?\/]+/tree/([^?]+)`);

}

namespace Private {

  export function doRename(text: HTMLElement, edit: HTMLInputElement) {
    let parent = text.parentElement as HTMLElement;
    parent.replaceChild(edit, text);
    edit.focus();
    let index = edit.value.lastIndexOf('.');
    if (index === -1) {
      edit.setSelectionRange(0, edit.value.length);
    } else {
      edit.setSelectionRange(0, index);
    }
    // handle enter
    return new Promise<string>((resolve, reject) => {
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
    let body = document.createElement('div');
    let existingLabel = document.createElement('label');
    existingLabel.textContent = 'File Path:';

    let input = document.createElement('input');
    input.value = '';
    input.placeholder = '/path/to/file';

    body.appendChild(existingLabel);
    body.appendChild(input);
    return body;
  }

}

class OpenDirectWidget extends Widget {
  /**
   * Construct a new open file widget.
   */
  constructor() {
    super({ node: Private.createOpenNode() });
  }

  /**
   * Get the value of the widget.
   */
  getValue(): string {
    return this.inputNode.value;
  }

  /**
   * Get the input text node.
   */
  get inputNode(): HTMLInputElement {
    return this.node.getElementsByTagName('input')[0] as HTMLInputElement;
  }
}

export class FileTreeWidget extends Widget {
  cm: ContentsManager;
  dr: DocumentRegistry;
  commands: any;
  toolbar: Toolbar;
  table: HTMLTableElement;
  tree: HTMLElement;
  controller: any;
  selected: string;

  constructor(lab: JupyterLab) {
    super();

    this.id = 'filetree-jupyterlab';
    this.title.iconClass = 'filetree-icon';
    this.title.caption= 'File Tree';
    this.title.closable = true;
    this.addClass('jp-filetreeWidget');

    this.cm = lab.serviceManager.contents;
    this.dr = lab.docRegistry;
    this.commands = lab.commands;
    this.toolbar = new Toolbar<Widget>();
    this.controller = {};
    this.selected = '';

    this.toolbar.addClass('filetree-toolbar');

    let layout = new PanelLayout();
    layout.addWidget(this.toolbar);

    this.layout = layout;

    let base = this.cm.get('');
    base.then(res => {
      this.controller[''] = {'last_modified': res.last_modified, 'open':true};
      var table = this.buildTable(['File Name', 'Last Modified'], res.content);
      this.node.appendChild(table);
    });
  }

  buildTable(headers: any, data: any) {
    let table = document.createElement('table');
    table.className = 'filetree-head';
    let thead = table.createTHead();
    let tbody = table.createTBody();
    tbody.id = 'filetree-body';
    let headRow = document.createElement('tr');
    headers.forEach(function(el: string) {
      let th = document.createElement('th');
      th.appendChild(document.createTextNode(el));
      headRow.appendChild(th);
    });
    headRow.children[headRow.children.length - 1].className = 'modified';
    thead.appendChild(headRow);
    table.appendChild(thead);

    this.table = table;
    this.tree = tbody;
    this.buildTableContents(data, 1, '');

    table.appendChild(tbody);

    return table;
  }

  reload() { // rebuild tree
    this.table.removeChild(this.tree);
    let tbody = this.table.createTBody();
    tbody.id = 'filetree-body';
    this.tree = tbody;
    let base = this.cm.get('');
    base.then(res => {
      this.buildTableContents(res.content, 1, '');
    });
    this.table.appendChild(tbody);
    return base;
  }

  restore() { // restore expansion prior to rebuild
    let array: Promise<any>[] = [];
    Object.keys(this.controller).forEach(key => {
      if(this.controller[key]['open'] && key !== '') {
        var promise = this.cm.get(key);
        promise.catch(res => { console.log(res); });
        array.push(promise);
      }
    });
    Promise.all(array).then(results => {
      for(var r in results) {
        var row_element = document.getElementById(results[r].path);
        this.buildTableContents(results[r].content, 1+results[r].path.split('/').length, row_element);
      }
    }).catch(reasons => {
      console.log(reasons);
    });
  }

  refresh() {
    this.reload();
    this.restore();
  }

  updateController(oldPath: string, newPath: string) { // replace keys for renamed path
    Object.keys(this.controller).forEach(key => {
      if(key.startsWith(oldPath)) {
        if(newPath !== '')
          this.controller[key.replace(oldPath, newPath)] = this.controller[key];
        delete this.controller[key];  
      }
    });
  }

  buildTableContents(data: any, level: number, parent: any) {
    let commands = this.commands;
    let map = this.sortContents(data);
    for(var index in data) {
      let sorted_entry = map[parseInt(index)];
      let entry = data[sorted_entry[1]];
      let tr = this.createTreeElement(entry, level);

      if (entry.type === 'directory') {
        tr.onclick = function() { commands.execute(CommandIDs.toggle, {'row': entry.path, 'level': level+1}); }
        tr.oncontextmenu = function() { commands.execute(CommandIDs.set_context, {'path': entry.path}); }
        if (!(entry.path in this.controller))
          this.controller[entry.path] = {'last_modified': entry.last_modified, 'open':false};
      } else {
        tr.onclick = function() { commands.execute('docmanager:open', {'path': entry.path}); } 
        tr.oncontextmenu = function() { commands.execute(CommandIDs.set_context, {'path': entry.path}); }
      }

      if(level === 1)
        this.tree.appendChild(tr);
      else {
        parent.after(tr);
        parent = tr;
      }
    }
  }

  sortContents(data: any) {
    let names = [];
    for(var i in data) {
      names[names.length] = [data[i].name, parseInt(i)]
    }
    return names.sort();
  }

  createTreeElement(object: any, level: number) {
    let tr = document.createElement('tr');
    let td = document.createElement('td');
    let td1 = document.createElement('td');
    tr.className = 'filetree-item';

    let icon = document.createElement('span');
    icon.className = 'jp-DirListing-itemIcon ';
    if(object.type === 'directory') {
      icon.className += this.dr.getFileType('directory').iconClass;
      tr.className += ' filetree-folder';
    } else {
      var iconClass = this.dr.getFileTypesForPath(object.path);
      tr.className += ' filetree-file';
      if (iconClass.length == 0)
        icon.className += this.dr.getFileType('text').iconClass;
      else
        icon.className += this.dr.getFileTypesForPath(object.path)[0].iconClass;
    }
    
    td.appendChild(icon);  
    let title = document.createElement('span');
    title.innerHTML = object.name;
    title.className = 'filetree-text-span';
    td.appendChild(title);
    td.className = 'filetree-item-text'; 
    td.style.setProperty('--indent', level + 'em');

    let date = document.createElement('span');
    date.innerHTML = Time.formatHuman(object.last_modified);
    td1.className = 'filetree-date';
    td1.appendChild(date);

    tr.appendChild(td);
    tr.appendChild(td1);
    tr.id = object.path;

    return tr;
  }

  download(path: string): Promise<void> {
    return this.cm.getDownloadUrl(path).then(url => {
      let element = document.createElement('a');
      document.body.appendChild(element);
      element.setAttribute('href', url);
      element.setAttribute('download', '');
      element.click();
      document.body.removeChild(element);
      return void 0;
    });
  }

}

function switchView(mode: any) {
  if(mode == "none") return "";
  else return "none"
}

function activate(app: JupyterLab, restorer: ILayoutRestorer, manager: IDocumentManager, router: IRouter) {
  console.log('JupyterLab extension jupyterlab_filetree is activated!');

  let widget = new FileTreeWidget(app);
  restorer.add(widget, 'filetree-jupyterlab');
  app.shell.addToLeftArea(widget);

  let uploader = new Uploader({'manager': manager, 'widget': widget});

  app.commands.addCommand(CommandIDs.toggle, {
    execute: args => {
      let row = args['row'] as string;
      let level = args['level'] as number;

      var row_element = document.getElementById(row);

      if(row_element.nextElementSibling.id.startsWith(row)) { // next element in folder, already constructed
        var display = switchView(document.getElementById(row_element.nextElementSibling.id).style.display);
        widget.controller[row]['open'] = !(widget.controller[row]['open'])
        var open_flag = widget.controller[row]['open'];
        // open folder
        while (row_element.nextElementSibling.id.startsWith(row)) {
          row_element = document.getElementById(row_element.nextElementSibling.id);
          // check if the parent folder is open
          if(!(open_flag) || widget.controller[PathExt.dirname(row_element.id)]['open']) 
            row_element.style.display = display;
        }
      } else { // if children elements don't exist yet
        let base = app.serviceManager.contents.get(row);
        base.then(res => {
          widget.buildTableContents(res.content, level, row_element);
          widget.controller[row] = {'last_modified': res.last_modified, 'open':true};
        });
      }
    }
  });

  app.commands.addCommand(CommandIDs.navigate, {
    execute: async args => {
      const treeMatch = router.current.path.match(Patterns.tree);
      const workspaceMatch = router.current.path.match(Patterns.workspace);
      const match = treeMatch || workspaceMatch;
      const path = decodeURI(match[1]);
      const { page, workspaces } = app.info.urls;
      const workspace = PathExt.basename(app.info.workspace);
      const url =
        (workspaceMatch ? URLExt.join(workspaces, workspace) : page) +
        router.current.search +
        router.current.hash;
        const silent = true;

      // Silently remove the tree portion of the URL leaving the rest intact.
      router.navigate(url, { silent });

      try {
        var paths: string[] = [];
        var temp: string[] = path.split('/');
        var current: string = '';
        for(var t in temp) {
          current += (current == '') ? temp[t] : '/' + temp[t];
          paths.push(current);
        }
        let array: Promise<any>[] = [];
        paths.forEach(key => {
          array.push(app.serviceManager.contents.get(key));
        });
        Promise.all(array).then(results => {
          for(var r in results) {
            if(results[r].type === 'directory') {
              var row_element = document.getElementById(results[r].path);
              widget.buildTableContents(results[r].content, 1+results[r].path.split('/').length, row_element);
            }
          }
        });
      } catch (error) {
        console.warn('Tree routing failed.', error);
      }
    }
  });

  app.commands.addCommand(CommandIDs.refresh, {
    execute: () => {
      Object.keys(widget.controller).forEach(key => {
      let promise = app.serviceManager.contents.get(key);
      promise.then(async res => {
        if(res.last_modified > widget.controller[key]['last_modified']){
          widget.controller[key]['last_modified'] = res.last_modified;
          await widget.reload();
          widget.restore();
        }
      });
      promise.catch(reason => {
        console.log(reason);
        delete widget.controller[key];
      })
    });
    }
  })

  router.register({ command: CommandIDs.navigate, pattern: Patterns.tree });
  router.register({ command: CommandIDs.navigate, pattern: Patterns.workspace });

  app.commands.addCommand(CommandIDs.set_context, {
    label: 'Need some Context',
    execute: args => {
      widget.selected = args['path'] as string;
    }
  }); 

  app.commands.addCommand(CommandIDs.rename, {
    label: 'Rename',
    iconClass: 'p-Menu-itemIcon jp-MaterialIcon jp-EditIcon',
    execute: () => {
      let td = document.getElementById(widget.selected).getElementsByClassName('filetree-item-text')[0];
      let text_area = td.getElementsByClassName('filetree-text-span')[0] as HTMLElement;
      let original = text_area.innerHTML;
      let edit = document.createElement('input');
      edit.value = original;
      Private.doRename(text_area, edit).then(newName => {
        if (!newName || newName === original) {
          return original;
        }
        if (!isValidFileName(newName)) {
          showErrorMessage(
            'Rename Error',
            Error(
              `"${newName}" is not a valid name for a file. ` +
                `Names must have nonzero length, ` +
                `and cannot include "/", "\\", or ":"`
            )
          );
          return original;
        }
        let current_id = widget.selected;
        let new_path = PathExt.join(PathExt.dirname(widget.selected), newName);
        renameFile(manager, current_id, new_path);
        widget.updateController(current_id, new_path);
        text_area.innerHTML = newName;
      });
    }
  })

  app.commands.addCommand(CommandIDs.create_folder, {
    label: 'New Folder',
    iconClass: 'p-Menu-itemIcon jp-MaterialIcon jp-NewFolderIcon',
    execute: args => {
      manager.newUntitled({
        path: args['path'] as string || widget.selected,
        type: 'directory'
      });
    }
  })

  app.commands.addCommand(CommandIDs.create_file, {
    label: 'New File',
    iconClass: 'p-Menu-itemIcon jp-MaterialIcon jp-AddIcon',
    execute: () => {
      showDialog({
        title: 'Create File',
        body: new OpenDirectWidget(),
        buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'CREATE' })],
        focusNodeSelector: 'input'
      }).then((result: any) => {
        if (result.button.label === 'CREATE') {
          let new_file = PathExt.join(widget.selected, result.value);
          manager.createNew(new_file);
          if(!(widget.selected in widget.controller) || widget.controller[widget.selected]['open'] == false)
            app.commands.execute(CommandIDs.toggle, {'row': widget.selected, 'level': new_file.split('/').length});
        }
      });
    }
  })

  app.commands.addCommand(CommandIDs.delete_op, {
    label: 'Delete',
    iconClass: 'p-Menu-itemIcon jp-MaterialIcon jp-CloseIcon',
    execute: () => {
      let message = `Are you sure you want to delete: ${widget.selected} ?`;
      showDialog({
        title: 'Delete',
        body: message,
        buttons: [Dialog.cancelButton(), Dialog.warnButton({ label: 'DELETE' })]
      }).then((result: any) => {
        if (result.button.accept) {
          manager.deleteFile(widget.selected);
          widget.updateController(widget.selected, '');
        }
      });
    }
  })

  app.commands.addCommand(CommandIDs.download, {
    label: 'Download',
    iconClass: 'p-Menu-itemIcon jp-MaterialIcon jp-DownloadIcon',
    execute: () => {
      widget.download(widget.selected);
    }
  })

  app.commands.addCommand(CommandIDs.upload, {
    label: 'Upload',
    iconClass: 'p-Menu-itemIcon jp-MaterialIcon jp-FileUploadIcon',
    execute: () => {
      uploader.contextClick(widget.selected);
    }
  });

  // everything context menu
  app.contextMenu.addItem({
    command: CommandIDs.rename,
    selector: '.filetree-item',
    rank: 3
  });

  app.contextMenu.addItem({
    command: CommandIDs.delete_op,
    selector: '.filetree-item',
    rank: 4
  })

  // files only context menu
  app.contextMenu.addItem({
    command: CommandIDs.download,
    selector: '.filetree-file',
    rank: 1
  })

  // folder only context menu
  app.contextMenu.addItem({
    command: CommandIDs.create_folder,
    selector: '.filetree-folder',
    rank: 2
  })

  app.contextMenu.addItem({
    command: CommandIDs.create_file,
    selector: '.filetree-folder',
    rank: 1
  })

  app.contextMenu.addItem({
    command: CommandIDs.upload,
    selector: '.filetree-folder',
    rank: 3
  })

  let new_file = new ToolbarButton({
    iconClassName: 'jp-NewFolderIcon jp-Icon jp-Icon-16',
    onClick: () => {
      app.commands.execute(CommandIDs.create_folder, {'path': ''});
    },
    tooltip: 'New Folder'
  });
  widget.toolbar.addItem('new file', new_file);

  widget.toolbar.addItem('upload', uploader);

  let refresh = new ToolbarButton({
    iconClassName: 'jp-RefreshIcon jp-Icon jp-Icon-16',
    onClick: () => {
      app.commands.execute(CommandIDs.refresh);
    },
    tooltip: 'Refresh'
  });
  widget.toolbar.addItem('refresh', refresh);

  setInterval(() => {
    app.commands.execute(CommandIDs.refresh);
  }, 10000);
}

const extension: JupyterLabPlugin<void> = {
  id: 'jupyterlab_filetree',
  autoStart: true,
  requires: [ILayoutRestorer, IDocumentManager, IRouter],
  activate: activate
};

export default extension;
