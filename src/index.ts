import {
  JupyterFrontEnd, JupyterFrontEndPlugin, ILayoutRestorer, IRouter
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
  showErrorMessage, showDialog, Dialog, Toolbar, ToolbarButton, Clipboard, IWindowResolver
} from '@jupyterlab/apputils';

import {
  Widget, PanelLayout
} from '@phosphor/widgets';

import {
  Uploader
} from './upload';

import { saveAs } from 'file-saver';

import * as JSZip from 'jszip';

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

  export const move = 'filetree:move';

  export const copy_path = 'filetree:copy_path';
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

  constructor() {
    super({ node: Private.createOpenNode() });
  }

  getValue(): string {
    return this.inputNode.value;
  }

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
  basepath: string = '';

  constructor(lab: JupyterFrontEnd,
              basepath: string = '',
              id: string = 'jupyterlab-filetree') {
    super();
    this.id = id;
    this.title.iconClass = 'filetree-icon';
    this.title.caption= 'File Tree';
    this.title.closable = true;
    this.addClass('jp-filetreeWidget');
    this.addClass(id);

    this.cm = lab.serviceManager.contents;
    this.dr = lab.docRegistry;
    this.commands = lab.commands;
    this.toolbar = new Toolbar<Widget>();
    this.controller = {};
    this.selected = '';

    this.toolbar.addClass('filetree-toolbar');
    this.toolbar.addClass(id)

    let layout = new PanelLayout();
    layout.addWidget(this.toolbar);

    this.layout = layout;
    this.basepath = basepath;

    let base = this.cm.get(this.basepath + '');
    base.then(res => {
      this.controller[''] = {'last_modified': res.last_modified, 'open':true};
      var table = this.buildTable(['Name', 'Size', 'Timestamp', 'Permission'], res.content);
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
      th.className = 'filetree-header';
      th.appendChild(document.createTextNode(el));
      headRow.appendChild(th);
    });
    headRow.children[headRow.children.length - 1].className += ' modified';
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
    let base = this.cm.get(this.basepath + '');
    base.then(res => {
      this.buildTableContents(res.content, 1, '');
    });
    this.table.appendChild(tbody);
  }

  restore() { // restore expansion prior to rebuild
    let array: Promise<any>[] = [];
    Object.keys(this.controller).forEach(key => {
      if(this.controller[key]['open'] && (key !== '')) {
        var promise = this.cm.get(this.basepath + key);
        promise.catch(res => { console.log(res); });
        array.push(promise);
      }
    });
    Promise.all(array).then(results => {
      for(var r in results) {
        var row_element = document.getElementById(results[r].path.replace(this.basepath, ''));
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

      let path = entry.path;
      if(path.startsWith('/'))
        path = path.slice(1);

      tr.oncontextmenu = function() { commands.execute(CommandIDs.set_context, {'path': path}); }
      tr.draggable = true;
      tr.ondragstart = function(event) {event.dataTransfer.setData('Path', tr.id); }

      if (entry.type === 'directory') {
        tr.onclick = function() { commands.execute(CommandIDs.toggle, {'row': path, 'level': level+1}); }
        tr.ondrop = function(event) { commands.execute('filetree:move', {'from': event.dataTransfer.getData('Path'), 'to': path}); }
        tr.ondragover = function(event) {event.preventDefault();}
        if (!(path in this.controller))
          this.controller[path] = {'last_modified': entry.last_modified, 'open':false};
      } else {
        tr.onclick = () => { commands.execute('docmanager:open', {'path': this.basepath + path}); } 
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
    let td2 = document.createElement('td');
    let td3 = document.createElement('td');
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
    
    // icon and name
    td.appendChild(icon);  
    let title = document.createElement('span');
    title.innerHTML = object.name;
    title.className = 'filetree-name-span';
    td.appendChild(title);
    td.className = 'filetree-item-name'; 
    td.style.setProperty('--indent', level + 'em');

    // file size
    let size = document.createElement('span');
    size.innerHTML = fileSizeString(object.size);
    td1.className = 'filetree-attribute';
    td1.appendChild(size);

    // last modified
    let date = document.createElement('span');
    date.innerHTML = Time.format(object.last_modified);
    td2.className = 'filetree-attribute';
    td2.appendChild(date);

    // check permissions
    let perm = document.createElement('span');
    td3.className = 'filetree-attribute';
    if(object.writable)
      perm.innerHTML = 'Writable';
    else {
      this.cm.get(object.path)
      .then(res => {
        perm.innerHTML = 'Readable';
      })
      .catch(err => {
        perm.innerHTML = 'Locked';
      });
    }
    td3.appendChild(perm);

    tr.appendChild(td);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.id = object.path;

    return tr;
  }

  async download(path: string, folder: boolean, basepath: string = ''): Promise<any> {
    if(folder) {
      let zip = new JSZip();
      await this.wrapFolder(zip, path); // folder packing
      // generate and save zip, reset path
      path = PathExt.basename(path);
      writeZipFile(zip, path);
    } else {
      return this.cm.getDownloadUrl(basepath + path).then(url => {
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

  async wrapFolder(zip: JSZip, path: string, basepath: string = '') {
    let base = this.cm.get(basepath + path);
    let next = base.then(async res => {
      if(res.type == 'directory') {
        console.log('New Folder: ' + res.name);
        let new_folder = zip.folder(res.name);
        for(let c in res.content){
          await this.wrapFolder(new_folder, res.content[c].path);
        }
      } else {
        console.log("Upload: " + res.name);
        zip.file(res.name, res.content);
        console.log(res.content); // need to wait to pull content
      }
    });
    await next;
  }

}

function switchView(mode: any) {
  if(mode == "none") return "";
  else return "none"
}

function fileSizeString(fileBytes: number) {
    if(fileBytes == null)
      return ''
    if(fileBytes < 1024)
      return fileBytes + ' B'

    let i = -1;
    let byteUnits = [' KB', ' MB', ' GB', ' TB'];
    do {
        fileBytes = fileBytes / 1024;
        i++;
    } while (fileBytes > 1024);

    return Math.max(fileBytes, 0.1).toFixed(1) + byteUnits[i];
};

function writeZipFile(zip: JSZip, path: string){
  zip.generateAsync({type: 'blob'}).then(content => {
    saveAs(content, PathExt.basename(path));
  });
}

function activate(app: JupyterFrontEnd, paths: JupyterFrontEnd.IPaths, resolver: IWindowResolver, restorer: ILayoutRestorer, manager: IDocumentManager, router: IRouter) {
  console.log('JupyterLab extension jupyterlab_filetree is activated!');
  constructFileTreeWidget(app, '', 'filetree-jupyterlab', 'left', paths, resolver, restorer, manager, router);
}

export
function constructFileTreeWidget(app: JupyterFrontEnd,
  basepath: string = '',
  id: string = 'filetree-jupyterlab',
  side: string = 'left',
  paths: JupyterFrontEnd.IPaths,
  resolver: IWindowResolver,
  restorer: ILayoutRestorer,
  manager: IDocumentManager,
  router: IRouter){


  let widget = new FileTreeWidget(app, basepath, id || 'jupyterlab-filetree');
  restorer.add(widget, id || 'jupyterlab-filetree');
  app.shell.add(widget, side);

  let uploader = new Uploader({'manager': manager, 'widget': widget, basepath: basepath, filetree_id: id || 'jupyterlab-filetree'});

  app.commands.addCommand((CommandIDs.toggle + ':' + id), {
    execute: args => {
      let row = args['row'] as string;
      let level = args['level'] as number;

      var row_element = document.getElementById(row);

      if(row_element.nextElementSibling && row_element.nextElementSibling.id.startsWith(row)) { // next element in folder, already constructed
        var display = switchView(document.getElementById(row_element.nextElementSibling.id).style.display);
        widget.controller[row]['open'] = !(widget.controller[row]['open'])
        var open_flag = widget.controller[row]['open'];
        // open folder
        while (row_element.nextElementSibling && row_element.nextElementSibling.id.startsWith(row + '/')) {
          row_element = document.getElementById(row_element.nextElementSibling.id);
          // check if the parent folder is open
          if(!(open_flag) || widget.controller[PathExt.dirname(row_element.id)]['open']) 
            row_element.style.display = display;
        }
      } else { // if children elements don't exist yet
        let base = app.serviceManager.contents.get(widget.basepath + row);
        base.then(res => {
          widget.buildTableContents(res.content, level, row_element);
          widget.controller[row] = {'last_modified': res.last_modified, 'open':true};
        });
      }
    }
  });

  app.commands.addCommand((CommandIDs.navigate + ':' + id), {
    execute: async args => {
      const treeMatch = router.current.path.match(Patterns.tree);
      const workspaceMatch = router.current.path.match(Patterns.workspace);
      const match = treeMatch || workspaceMatch;
      const path = decodeURI(match[1]);
      // const { page, workspaces } = app.info.urls;
      const workspace = PathExt.basename(resolver.name);
      const url =
        (workspaceMatch ? URLExt.join(paths.urls.workspaces, workspace) : paths.urls.app) +
        router.current.search +
        router.current.hash;

      router.navigate(url);

      try {
        var tree_paths: string[] = [];
        var temp: string[] = path.split('/');
        var current: string = '';
        for(var t in temp) {
          current += (current == '') ? temp[t] : '/' + temp[t];
          tree_paths.push(current);
        }
        let array: Promise<any>[] = [];
        tree_paths.forEach(key => {
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

  app.commands.addCommand((CommandIDs.refresh + ':' + id), {
    execute: () => {
      Object.keys(widget.controller).forEach(key => {
        let promise = app.serviceManager.contents.get(widget.basepath + key);
        promise.then(async res => {
          if(res.last_modified > widget.controller[key]['last_modified']){
            widget.controller[key]['last_modified'] = res.last_modified;
          }
        });
        promise.catch(reason => {
          console.log(reason);
          delete widget.controller[key];
        })
      });
      widget.refresh()
    }
  })

  router.register({ command: (CommandIDs.navigate + ':' + id), pattern: Patterns.tree });
  router.register({ command: (CommandIDs.navigate + ':' + id), pattern: Patterns.workspace });

  app.commands.addCommand((CommandIDs.set_context + ':' + id), {
    label: 'Need some Context',
    execute: args => {
      if(widget.selected != '') {
        let element = document.getElementById(widget.selected)
        if(element != null)
          element.className = element.className.replace('selected', '');
      }
      widget.selected = args['path'] as string;
      if(widget.selected != '') {
        let element = document.getElementById(widget.selected)
        if(element != null)
          element.className += ' selected';
      }
    }
  }); 

  // remove context highlight on context menu exit
  document.ondblclick = function() { app.commands.execute((CommandIDs.set_context + ':' + id), {'path': ''}); }

  app.commands.addCommand((CommandIDs.rename + ':' + id), {
    label: 'Rename',
    iconClass: 'p-Menu-itemIcon jp-MaterialIcon jp-EditIcon',
    execute: () => {
      let td = document.getElementById(widget.selected).getElementsByClassName('filetree-item-name')[0];
      let text_area = td.getElementsByClassName('filetree-name-span')[0] as HTMLElement;
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
        renameFile(manager, widget.basepath + current_id, widget.basepath + new_path);
        widget.updateController(current_id, new_path);
        text_area.innerHTML = newName;
        widget.refresh();
      });
    }
  })

  app.commands.addCommand((CommandIDs.create_folder + ':' + id), {
    label: 'New Folder',
    iconClass: 'p-Menu-itemIcon jp-MaterialIcon jp-NewFolderIcon',
    execute: async args => {
      await manager.newUntitled({
        path: widget.basepath + (args['path'] as string || widget.selected),
        type: 'directory'
      });
      widget.refresh();
    }
  })

  app.commands.addCommand((CommandIDs.create_file + ':' + id), {
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
          manager.createNew(widget.basepath + new_file);
          if(!(widget.selected in widget.controller) || widget.controller[widget.selected]['open'] == false)
            app.commands.execute(CommandIDs.toggle, {'row': widget.selected, 'level': new_file.split('/').length});
          widget.refresh();
        }
      });
    }
  })

  app.commands.addCommand((CommandIDs.delete_op + ':' + id), {
    label: 'Delete',
    iconClass: 'p-Menu-itemIcon jp-MaterialIcon jp-CloseIcon',
    execute: () => {
      let message = `Are you sure you want to delete: ${widget.selected} ?`;
      showDialog({
        title: 'Delete',
        body: message,
        buttons: [Dialog.cancelButton(), Dialog.warnButton({ label: 'DELETE' })]
      }).then(async (result: any) => {
        if (result.button.accept) {
          await manager.deleteFile(widget.basepath + widget.selected);
          widget.updateController(widget.selected, '');
          app.commands.execute(CommandIDs.set_context, {'path': ''});
          widget.refresh();
        }
      });
    }
  })

  app.commands.addCommand((CommandIDs.download + ':' + id), {
    label: 'Download',
    iconClass: 'p-Menu-itemIcon jp-MaterialIcon jp-DownloadIcon',
    execute: args => {
      widget.download(widget.selected, args['folder'] as boolean || false);
    }
  })

  app.commands.addCommand((CommandIDs.upload + ':' + id), {
    label: 'Upload',
    iconClass: 'p-Menu-itemIcon jp-MaterialIcon jp-FileUploadIcon',
    execute: () => {
      uploader.contextClick(widget.selected);
    }
  });

  app.commands.addCommand((CommandIDs.move + ':' + id), {
    label: 'Move',
    execute: args => {
      let from = args['from'] as string;
      let to = args['to'] as string;
      let file_name = PathExt.basename(from);
      let message = 'Are you sure you want to move ' + file_name + '?';
      showDialog({
        title: 'Move',
        body: message,
        buttons: [Dialog.cancelButton(), Dialog.warnButton({ label: 'MOVE' })]
      }).then(async (result: any) => {
        if (result.button.accept) {
          let new_path = PathExt.join(to, file_name)
          renameFile(manager, widget.basepath + from, widget.basepath + new_path);
          widget.updateController(from, new_path);
          widget.refresh();
        }
      });
    }
  })

  app.commands.addCommand((CommandIDs.copy_path + ':' + id), {
    label: 'Copy Path',
    iconClass: widget.dr.getFileType('text').iconClass,
    execute: () => {
      Clipboard.copyToSystem(widget.selected);
    }
  })

  // everything context menu
  app.contextMenu.addItem({
    command: (CommandIDs.rename + ':' + id),
    selector: '.filetree-item',
    rank: 3
  });

  app.contextMenu.addItem({
    command: (CommandIDs.delete_op + ':' + id),
    selector: '.filetree-item',
    rank: 4
  })

  app.contextMenu.addItem({
    command: (CommandIDs.copy_path + ':' + id),
    selector: '.filetree-item',
    rank: 5
  })

  // files only context menu
  app.contextMenu.addItem({
    command: (CommandIDs.download + ':' + id),
    selector: '.filetree-file',
    rank: 1
  })

  // folder only context menu
  app.contextMenu.addItem({
    command: (CommandIDs.create_folder + ':' + id),
    selector: '.filetree-folder',
    rank: 2
  })

  app.contextMenu.addItem({
    command: (CommandIDs.create_file + ':' + id),
    selector: '.filetree-folder',
    rank: 1
  })

  app.contextMenu.addItem({
    command: (CommandIDs.upload + ':' + id),
    selector: '.filetree-folder',
    rank: 3
  })

  app.contextMenu.addItem({
    command: (CommandIDs.download + ':' + id),
    args: {'folder': true},
    selector: '.filetree-folder',
    rank: 1
  })

  let new_file = new ToolbarButton({
    iconClassName: 'jp-NewFolderIcon jp-Icon jp-Icon-16',
    onClick: () => {
      app.commands.execute((CommandIDs.create_folder + ':' + id), {'path': ''});
    },
    tooltip: 'New Folder'
  });
  widget.toolbar.addItem('new file', new_file);

  widget.toolbar.addItem('upload', uploader);

  let refresh = new ToolbarButton({
    iconClassName: 'jp-RefreshIcon jp-Icon jp-Icon-16',
    onClick: () => {
      app.commands.execute((CommandIDs.refresh + ':' + id));
    },
    tooltip: 'Refresh'
  });
  widget.toolbar.addItem('refresh', refresh);

  // setInterval(() => {
  //   app.commands.execute(CommandIDs.refresh);
  // }, 10000);
}

const extension: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_filetree',
  autoStart: true,
  requires: [JupyterFrontEnd.IPaths, IWindowResolver, ILayoutRestorer, IDocumentManager, IRouter],
  activate: activate
};

export default extension;
