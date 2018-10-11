import {
  JupyterLab, JupyterLabPlugin, ILayoutRestorer
} from '@jupyterlab/application';

import {
  ContentsManager
} from '@jupyterlab/services';

import {
  Widget
} from '@phosphor/widgets';

import '../style/index.css';

class FileTreeWidget extends Widget {
  cm: ContentsManager;
  commands: any
  table: HTMLElement;

  constructor(lab: JupyterLab) {
    super();

    this.id = 'filetree-jupyterlab';
    this.title.iconClass = 'filetree-icon';
    this.title.caption= 'File Tree';
    this.title.closable = true;
    this.addClass('jp-filetreeWidget');

    this.cm = lab.serviceManager.contents;
    this.commands = lab.commands;

    let base = this.cm.get('');
    base.then((res) => {
      var table = this.buildTable(['File Name'], res.content);
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

    this.table = tbody;
    this.buildTableContents(data, 1, '');

    table.appendChild(tbody);

    return table;
  }

  buildTableContents(data: any, level: number, parent: any) {
  	let commands = this.commands
    for(var index in data) {
	  let entry = data[index];
      let tr = this.createTreeElement(entry, level);

      if (entry.type === 'directory') {
        tr.onclick = function() { commands.execute('filetree:toggle', {'row': entry.path, 'level': level+1}); }
      } else {
        tr.onclick = function() { commands.execute('docmanager:open', {'path': entry.path}); } 
      }

      if(level === 1)
	    this.table.appendChild(tr);
      else
	    parent.after(tr);
    }
  }

  toggleFolder(row: any, newLevel: number) {
  	this.commands.execute('filetree:toggle');
  	console.log(this);

  }

  switchView(mode: any) {
    if(mode == "none") return "";
    else return "none"
  }

  createTreeElement(object: any, level: number) {
	let tr = document.createElement('tr');
    let td = document.createElement('td');

    let icon = document.createElement('span');
    icon.className = 'jp-DirListing-itemIcon jp-MaterialIcon ';
    if(object.type === 'directory')
      icon.className += 'jp-OpenFolderIcon';
    else
      icon.className += 'jp-FileIcon';
    
    td.appendChild(icon);  
    let title = document.createElement('span');
    title.innerHTML = object.name;
    td.appendChild(title);
    td.className = 'filetree-item-text'; 
    td.style.setProperty('--indent', level + 'em');

    tr.appendChild(td);
    tr.className = 'filetree-item';
    tr.id = object.path;

    return tr;
  }

}

function activate(app: JupyterLab, restorer: ILayoutRestorer) {
  console.log('JupyterLab extension jupyterlab_filetree is activated!');

  let widget = new FileTreeWidget(app);
  restorer.add(widget, 'filetree-jupyterlab');
  app.shell.addToLeftArea(widget);

  const toggle_command: string = 'filetree:toggle';

  app.commands.addCommand(toggle_command, {
    execute: args => {
      let row = args['row'] as string;
      let level = args['level'] as number;

      let row_element = document.getElementById(row);
      if(row_element.nextElementSibling.id.startsWith(row)) { // next element in folder, already constructed
        
      } else { // if children elements don't exist yet
        let base = app.serviceManager.contents.get(row);
        base.then(res => {
          widget.buildTableContents(res.content, level, row_element);
        });
      }
    }
  });
}

const extension: JupyterLabPlugin<void> = {
  id: 'jupyterlab_filetree',
  autoStart: true,
  requires: [ILayoutRestorer],
  activate: activate
};

export default extension;
