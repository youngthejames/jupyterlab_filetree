import {
  JupyterLab, JupyterLabPlugin, ILayoutRestorer
} from '@jupyterlab/application';

import {
  ContentsManager
} from '@jupyterlab/services';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  IDocumentManager
} from '@jupyterlab/docmanager';

import {
	Time
} from '@jupyterlab/coreutils';

import {
  Widget
} from '@phosphor/widgets';

import '../style/index.css';

class FileTreeWidget extends Widget {
  cm: ContentsManager;
  dr: DocumentRegistry;
  commands: any;
  table: HTMLTableElement;
  tree: HTMLElement;
  controller: any;

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
    this.controller = {};

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
  }

  restore() { // restore expansion prior to rebuild
    let array: Promise<any>[] = [];
    Object.keys(this.controller).forEach(key => {
      if(this.controller[key]['open'] && key !== '') {
        array.push(this.cm.get(key));
      }
    });
    Promise.all(array).then(results => {
      for(var r in results) {
        var row_element = document.getElementById(results[r].path);
        this.buildTableContents(results[r].content, 1+results[r].path.split('/').length, row_element);
      }
    });
  }

  buildTableContents(data: any, level: number, parent: any) {
    let commands = this.commands
    let map = this.sortContents(data);
    for(var index in data) {
      let sorted_entry = map[parseInt(index)];
      let entry = data[sorted_entry[1]];
      let tr = this.createTreeElement(entry, level);

      if (entry.type === 'directory') {
        tr.onclick = function() { commands.execute('filetree:toggle', {'row': entry.path, 'level': level+1}); }
        if (!(entry.path in this.controller))
          this.controller[entry.path] = {'last_modified': entry.last_modified, 'open':false};
      } else {
        tr.onclick = function() { commands.execute('docmanager:open', {'path': entry.path}); } 
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

  toggleFolder(row: any, newLevel: number) {
    this.commands.execute('filetree:toggle');
  }

  createTreeElement(object: any, level: number) {
    let tr = document.createElement('tr');
    let td = document.createElement('td');
    let td1 = document.createElement('td');

    let icon = document.createElement('span');
    icon.className = 'jp-DirListing-itemIcon ';
    if(object.type === 'directory')
      icon.className += this.dr.getFileType('directory').iconClass;
    else {
      var iconClass = this.dr.getFileTypesForPath(object.path);
      if (iconClass.length == 0)
        icon.className += this.dr.getFileType('text').iconClass;
      else
        icon.className += this.dr.getFileTypesForPath(object.path)[0].iconClass;
    }
    
    td.appendChild(icon);  
    let title = document.createElement('span');
    title.innerHTML = object.name;
    td.appendChild(title);
    td.className = 'filetree-item-text'; 
    td.style.setProperty('--indent', level + 'em');

    let date = document.createElement('span');
    date.innerHTML = Time.formatHuman(object.last_modified);
    td1.className = 'filetree-date';
    td1.appendChild(date);

    tr.appendChild(td);
    tr.appendChild(td1);
    tr.className = 'filetree-item';
    tr.id = object.path;

    return tr;
  }

}

function switchView(mode: any) {
  if(mode == "none") return "";
  else return "none"
}

function activate(app: JupyterLab, restorer: ILayoutRestorer, manager: IDocumentManager) {
  console.log('JupyterLab extension jupyterlab_filetree is activated!');

  let widget = new FileTreeWidget(app);
  restorer.add(widget, 'filetree-jupyterlab');
  app.shell.addToLeftArea(widget);

  const toggle_command: string = 'filetree:toggle';
  app.commands.addCommand(toggle_command, {
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
          if(!(open_flag) || widget.controller[row_element.id.substring(0,row_element.id.lastIndexOf('/'))]['open']) 
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

  setInterval(() => {
    Object.keys(widget.controller).forEach(key => {
      let promise = app.serviceManager.contents.get(key);
      promise.then(res => {
        if(res.last_modified > widget.controller[key]['last_modified']){
          widget.controller[key]['last_modified'] = res.last_modified;
          widget.reload();
          widget.restore();
        }
      });
    });
  }, 10000);
}

const extension: JupyterLabPlugin<void> = {
  id: 'jupyterlab_filetree',
  autoStart: true,
  requires: [ILayoutRestorer, IDocumentManager],
  activate: activate
};

export default extension;
