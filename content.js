const REQUIRED_HEADERS = ['序号', '摘要', '费用类型', '明细费用类型', '借方科目', '金额'];
const ALTERNATIVE_HEADERS = ['序号', '日期', '出发地点', '到达地点', '用途', '报销金额'];

function getTextContent(element) {
  if (element.nodeType === Node.TEXT_NODE) {
    return element.textContent.trim();
  }
  if (element.tagName.toLowerCase() === 'input') {
    return element.value.trim();
  }
  let text = '';
  for (let child of element.childNodes) {
    text += getTextContent(child);
  }
  return text;
}

function findHeaderRow(table) {
  const rows = Array.from(table.getElementsByTagName('tr'));
  
  for (let i = 0; i < rows.length; i++) {
    const cells = Array.from(rows[i].getElementsByTagName('td'));
    
    const headerTexts = cells.map(cell => getTextContent(cell));
    
    if (REQUIRED_HEADERS.every(header => headerTexts.includes(header))) {
      return {
        headerRow: rows[i],
        headerIndex: i,
        cells: cells,
        headerMap: headerTexts.reduce((map, header, index) => {
          map[header] = index;
          return map;
        }, {})
      };
    }
    
    if (ALTERNATIVE_HEADERS.every(header => headerTexts.includes(header))) {
      return {
        headerRow: rows[i],
        headerIndex: i,
        cells: cells,
        headerMap: headerTexts.reduce((map, header, index) => {
          map[header] = index;
          return map;
        }, {}),
        isAlternative: true
      };
    }
  }
  
  return null;
}

function extractTableData() {
  try {
    console.log('Attempting to locate table...');
    const table = document.getElementById('oTable0');
    if (!table) {
      console.error('Table not found');
      return { error: '未找到表格' };
    }

    // 获取requestmarkSpan的value
    const requestmarkSpan = document.getElementById('requestmarkSpan');
    const idValue = requestmarkSpan ? requestmarkSpan.textContent.trim() : '';

    const headerInfo = findHeaderRow(table);
    if (!headerInfo) {
      return { error: '未找到包含指定表头的行' };
    }

    const rows = Array.from(table.getElementsByTagName('tr'))
      .slice(headerInfo.headerIndex + 1);

    const data = rows.map(row => {
      const cells = row.getElementsByTagName('td');
      const rowData = { id: idValue }; // 添加id字段
      
      if (headerInfo.isAlternative) {
        rowData['序号'] = getTextContent(cells[headerInfo.headerMap['序号']]);
        rowData['摘要'] = getTextContent(cells[headerInfo.headerMap['用途']]);
        rowData['费用类型'] = '差旅费差旅费';
        rowData['明细费用类型'] = '差旅费差旅费';
        rowData['借方科目'] = '差旅费6602.008';
        rowData['金额'] = parseFloat(getTextContent(cells[headerInfo.headerMap['报销金额']]).replace(/[^\d.-]/g, '')) || 0;
      } else {
        // 处理需要的列
        REQUIRED_HEADERS.forEach(header => {
          const cellIndex = headerInfo.headerMap[header];
          if (cells.length > cellIndex) {
            const text = getTextContent(cells[cellIndex]);
            rowData[header] = header === '金额' ? 
              parseFloat(text.replace(/[^\d.-]/g, '')) || 0 : 
              text;
          }
        });
      }
      
      return rowData;
    }).filter(row => {
      const isEmptyRow = Object.values(row).every(value => 
        (typeof value === 'string' && value.trim() === '') ||
        (typeof value === 'number' && value === 0)
      );
      const isAmountZero = row.金额 === 0;
      
      return !isEmptyRow && !isAmountZero;
    });

    if (data.length === 0) {
      return { error: '未找到有效的数据' };
    }

    return {
      success: true,
      data: data
    };
  } catch (err) {
    console.error('Error occurred during data extraction:', err);
    return { error: `计算错误: ${err.message}` };
  }
}

function jsonToHtmlTable(jsonData) {
  if (!jsonData || jsonData.length === 0) return '';
  
  // 确保id列在最前面
  const keys = Object.keys(jsonData[0]);
  const orderedKeys = ['id'].concat(keys.filter(k => k !== 'id'));
  
  let html = '<table border="0"><tr>';
  orderedKeys.forEach(key => {
    html += `<th>${key}</th>`;
  });
  html += '</tr>';
  
  jsonData.forEach(item => {
    html += '<tr>';
    orderedKeys.forEach(key => {
      html += `<td>${item[key]}</td>`;
    });
    html += '</tr>';
  });
  
  html += '</table>';
  return html;
}

function showToast(message, isError = false) {
  const existingToast = document.querySelector('.custom-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `custom-toast${isError ? ' error' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // 添加自动消失逻辑
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300); // 等待CSS过渡完成
  }, 3000); // 3秒后自动消失
}

// 在content.js中添加以下方法
async function copyTable() {
  console.log('copyTable function called');
  const result = extractTableData();
  if (result.error) {
    showToast(result.error, true);
    return;
  }

  const htmlContent = jsonToHtmlTable(result.data);
  const plainContent = result.data.map(row => 
    Object.values(row).join('\t')
  ).join('\n');

  try {
    // 现代浏览器复制方法
    const clipboardItem = new ClipboardItem({
      'text/html': new Blob([htmlContent], { type: 'text/html' }),
      'text/plain': new Blob([plainContent], { type: 'text/plain' })
    });
    await navigator.clipboard.write([clipboardItem]);
    showToast('表格已复制到剪贴板');
  } catch (error) {
    // 传统复制方法
    const textarea = document.createElement('textarea');
    textarea.value = plainContent;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('表格已复制为纯文本');
  }
  // 新增：发送数据到服务器
  try {
    const response = await fetch('http://localhost:9521/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result.data),
    });
    
    if (!response.ok) {
      const errorResponse = await response.json();
      throw new Error(errorResponse.detail || '服务器返回错误');
    }
    
    showToast('数据已成功发送到服务器');
  } catch (error) {
    showToast(`发送失败: ${error.message}`, true);
  }
}

// 更新消息监听器
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "copyTable") {
    copyTable();
  }
  return true;
}); 
