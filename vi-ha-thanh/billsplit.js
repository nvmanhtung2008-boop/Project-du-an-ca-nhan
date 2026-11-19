/* ==========================================================================
   TÍNH TIỀN, CHIA BILL THEO ĐẦU NGƯỜI & XUẤT HÓA ĐƠN CHI TIẾT
   ========================================================================== */
(function () {
  var STORAGE_KEY = 'hanoi_phovi_bill_v1';

  function $(id) {
    return document.getElementById(id);
  }

  function fmtDots(n) {
    var num = Math.max(0, Math.round(Number(n) || 0));
    return num.toLocaleString('vi-VN');
  }

  function parseMoney(str) {
    var digits = String(str || '').replace(/\D+/g, '');
    return digits ? parseInt(digits, 10) : 0;
  }

  function formatMoneyEl(el, allowEmpty) {
    if (!el) return 0;
    var raw = el.value;
    var digits = String(raw || '').replace(/\D+/g, '');
    if (!digits) {
      el.value = allowEmpty ? '' : '0';
      return 0;
    }
    var num = parseInt(digits, 10);
    var formatted = num.toLocaleString('vi-VN');
    if (el.value !== formatted) {
      var prevLen = el.value.length;
      var pos = el.selectionStart || prevLen;
      el.value = formatted;
      var diff = formatted.length - prevLen;
      var nextPos = Math.max(0, pos + diff);
      try { el.setSelectionRange(nextPos, nextPos); } catch (e) {}
    }
    return num;
  }

  function fmtVnd(n) {
    return Math.round(Number(n) || 0).toLocaleString('vi-VN') + 'đ';
  }

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showBillToast(msg) {
    var toast = $('toastNotice');
    if (!toast) return;
    toast.innerHTML = '<span>🧾</span> <span>' + escHtml(msg) + '</span>';
    toast.classList.add('show');
    clearTimeout(toast._billTimer);
    toast._billTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 2600);
  }

  var state = {
    placeName: 'Bữa ăn Hà Nội Phố Vị',
    peopleCount: 4,
    memberNames: [],
    items: [],
    directTotal: 0,
    discount: 0,
    vat: 0,
    tip: 0
  };

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          state.placeName = parsed.placeName || 'Bữa ăn Hà Nội Phố Vị';
          state.peopleCount = Math.max(1, Math.min(50, parseInt(parsed.peopleCount || 4, 10)));
          state.memberNames = Array.isArray(parsed.memberNames) ? parsed.memberNames : [];
          state.items = Array.isArray(parsed.items) ? parsed.items : [];
          state.directTotal = Math.max(0, Number(parsed.directTotal) || 0);
          state.discount = Math.max(0, Number(parsed.discount) || 0);
          state.vat = Math.max(0, Number(parsed.vat) || 0);
          state.tip = Math.max(0, Number(parsed.tip) || 0);
        }
      }
    } catch (e) {}
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function getMemberName(idx) {
    var custom = state.memberNames[idx];
    return (custom && custom.trim()) ? custom.trim() : ('Người ' + (idx + 1));
  }

  function populatePlaceSuggestions() {
    var dl = $('billPlaceSuggestions');
    if (!dl || dl.children.length > 0) return;
    if (typeof RESTAURANTS_DATA !== 'undefined' && Array.isArray(RESTAURANTS_DATA)) {
      dl.innerHTML = RESTAURANTS_DATA.slice(0, 200).map(function (r) {
        return '<option value="' + escHtml(r.name) + '"></option>';
      }).join('');
    }
  }

  function syncMemberControls() {
    var wrap = $('billMemberNamesWrap');
    var sel = $('billItemSplitMode');
    if (wrap) {
      var html = '';
      for (var i = 0; i < state.peopleCount; i++) {
        html += '<input type="text" data-member-idx="' + i + '" placeholder="Người ' + (i + 1) + '" value="' + escHtml(state.memberNames[i] || '') + '" />';
      }
      wrap.innerHTML = html;
      wrap.querySelectorAll('input').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var idx = parseInt(inp.getAttribute('data-member-idx'), 10);
          state.memberNames[idx] = inp.value;
          saveState();
          syncSplitSelectOnly();
          renderReceipt();
          renderItemsList();
        });
      });
    }
    syncSplitSelectOnly();
  }

  function syncSplitSelectOnly() {
    var sel = $('billItemSplitMode');
    if (!sel) return;
    var prev = sel.value;
    var opts = '<option value="all">Chia đều (' + state.peopleCount + ' người)</option>';
    for (var i = 0; i < state.peopleCount; i++) {
      opts += '<option value="' + i + '">Riêng: ' + escHtml(getMemberName(i)) + '</option>';
    }
    sel.innerHTML = opts;
    if (prev === 'all' || (parseInt(prev, 10) >= 0 && parseInt(prev, 10) < state.peopleCount)) {
      sel.value = prev;
    }
  }

  function computeBill() {
    var sharedSubtotal = 0;
    var personalTotals = [];
    for (var p = 0; p < state.peopleCount; p++) personalTotals.push(0);

    state.items.forEach(function (it) {
      var lineTotal = (Number(it.qty) || 1) * (Number(it.price) || 0);
      if (it.split === 'all' || it.split === undefined || parseInt(it.split, 10) >= state.peopleCount) {
        sharedSubtotal += lineTotal;
      } else {
        var idx = parseInt(it.split, 10);
        if (idx >= 0 && idx < state.peopleCount) {
          personalTotals[idx] += lineTotal;
        } else {
          sharedSubtotal += lineTotal;
        }
      }
    });

    var personalSum = personalTotals.reduce(function (a, b) { return a + b; }, 0);
    var itemsSubtotal = sharedSubtotal + personalSum;
    var usingDirectTotal = state.items.length === 0 && state.directTotal > 0;
    if (usingDirectTotal) {
      sharedSubtotal = state.directTotal;
    }
    var subtotal = usingDirectTotal ? state.directTotal : itemsSubtotal;
    var discount = Math.min(subtotal, Math.max(0, state.discount));
    var afterDiscount = Math.max(0, subtotal - discount);
    var vatAmt = Math.round(afterDiscount * (state.vat / 100));
    var tipAmt = Math.max(0, state.tip);
    var grandTotal = afterDiscount + vatAmt + tipAmt;
    var ratio = subtotal > 0 ? (grandTotal / subtotal) : 1;

    var perPerson = [];
    for (var i = 0; i < state.peopleCount; i++) {
      var baseShared = sharedSubtotal / state.peopleCount;
      var basePersonal = personalTotals[i];
      var finalAmt = Math.round((baseShared + basePersonal) * ratio);
      perPerson.push({
        name: getMemberName(i),
        sharedBase: Math.round(baseShared),
        personalBase: Math.round(basePersonal),
        total: finalAmt
      });
    }

    return {
      subtotal: subtotal,
      sharedSubtotal: sharedSubtotal,
      usingDirectTotal: usingDirectTotal,
      discount: discount,
      vatAmt: vatAmt,
      tipAmt: tipAmt,
      grandTotal: grandTotal,
      perPerson: perPerson,
      hasPersonalItems: personalSum > 0
    };
  }

  function renderItemsList() {
    var box = $('billItemsList');
    if (!box) return;
    if (!state.items.length) {
      box.innerHTML = '<div style="text-align:center;color:#8c735f;padding:12px;font-size:0.85rem;">Chưa có món nào. Hãy nhập từng món ở trên để lập hóa đơn!</div>';
      return;
    }

    box.innerHTML = state.items.map(function (it, idx) {
      var lineTotal = (Number(it.qty) || 1) * (Number(it.price) || 0);
      var isSolo = it.split !== 'all' && parseInt(it.split, 10) >= 0 && parseInt(it.split, 10) < state.peopleCount;
      var splitLabel = isSolo ? ('Riêng: ' + getMemberName(parseInt(it.split, 10))) : 'Chia đều';
      return '<div class="bill-item-row">' +
        '<span class="bill-item-idx">' + (idx + 1) + '.</span>' +
        '<div class="bill-item-main">' +
          '<strong>' + escHtml(it.name) + '</strong>' +
          '<span class="bill-item-sub">' + it.qty + ' × ' + fmtVnd(it.price) + '</span>' +
        '</div>' +
        '<span class="bill-item-split-tag' + (isSolo ? ' solo' : '') + '">' + escHtml(splitLabel) + '</span>' +
        '<span class="bill-item-total">' + fmtVnd(lineTotal) + '</span>' +
        '<button type="button" class="bill-item-del" data-del-idx="' + idx + '" title="Xóa mục này">🗑️</button>' +
      '</div>';
    }).join('');

    box.querySelectorAll('.bill-item-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-del-idx'), 10);
        state.items.splice(idx, 1);
        saveState();
        renderItemsList();
        renderReceipt();
      });
    });
  }

  function renderReceipt() {
    var paper = $('billReceiptPaper');
    if (!paper) return;
    var calc = computeBill();
    var nowStr = new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

    if ($('billLiveSubtotal')) $('billLiveSubtotal').textContent = fmtVnd(calc.subtotal);
    if ($('billLiveVatAmt')) $('billLiveVatAmt').textContent = fmtVnd(calc.vatAmt);
    if ($('billLiveGrandTotal')) $('billLiveGrandTotal').textContent = fmtVnd(calc.grandTotal);
    if ($('billLivePeople')) $('billLivePeople').textContent = state.peopleCount;
    var liveEach = state.peopleCount > 0 ? Math.round(calc.grandTotal / state.peopleCount) : calc.grandTotal;
    if ($('billLivePerPerson')) $('billLivePerPerson').textContent = fmtVnd(liveEach);
    if ($('billDirectTotal') && state.items.length > 0) {
      $('billDirectTotal').value = fmtDots(calc.subtotal);
      $('billDirectTotal').disabled = true;
    } else if ($('billDirectTotal')) {
      $('billDirectTotal').disabled = false;
    }

    var rowsHtml = '';
    if (calc.usingDirectTotal) {
      rowsHtml = '<tr><td>1</td><td>Tổng hóa đơn ăn uống (nhập nhanh)</td><td class="num">1</td><td class="num">' + fmtVnd(state.directTotal) + '</td><td class="num"><strong>' + fmtVnd(state.directTotal) + '</strong></td></tr>';
    } else if (!state.items.length) {
      rowsHtml = '<tr><td colspan="5" style="text-align:center;color:#8c735f;padding:14px;">(Chưa có món nào trong hóa đơn)</td></tr>';
    } else {
      rowsHtml = state.items.map(function (it, idx) {
        var lineTotal = (Number(it.qty) || 1) * (Number(it.price) || 0);
        var isSolo = it.split !== 'all' && parseInt(it.split, 10) >= 0 && parseInt(it.split, 10) < state.peopleCount;
        var note = isSolo ? ' <small style="color:#b45309;">(' + escHtml(getMemberName(parseInt(it.split, 10))) + ')</small>' : '';
        return '<tr>' +
          '<td>' + (idx + 1) + '</td>' +
          '<td>' + escHtml(it.name) + note + '</td>' +
          '<td class="num">' + it.qty + '</td>' +
          '<td class="num">' + fmtVnd(it.price) + '</td>' +
          '<td class="num"><strong>' + fmtVnd(lineTotal) + '</strong></td>' +
        '</tr>';
      }).join('');
    }

    var splitHtml = '';
    if (!calc.hasPersonalItems) {
      var each = state.peopleCount > 0 ? Math.round(calc.grandTotal / state.peopleCount) : calc.grandTotal;
      splitHtml = '<div class="rcpt-split-row"><span>Chia đều ' + state.peopleCount + ' người:</span><strong>' + fmtVnd(each) + ' / người</strong></div>';
    } else {
      splitHtml = calc.perPerson.map(function (p) {
        var detail = p.personalBase > 0 ? (' (chung ' + fmtVnd(p.sharedBase) + ' + riêng ' + fmtVnd(p.personalBase) + ')') : '';
        return '<div class="rcpt-split-row"><span>' + escHtml(p.name) + '<small>' + detail + '</small></span><strong>' + fmtVnd(p.total) + '</strong></div>';
      }).join('');
    }

    paper.innerHTML =
      '<div class="rcpt-head">' +
        '<div class="rcpt-brand">HÀ NỘI PHỐ VỊ • PHIẾU TÍNH TIỀN</div>' +
        '<div class="rcpt-title">' + escHtml(state.placeName || 'Bữa ăn nhóm') + '</div>' +
        '<div class="rcpt-meta">Ngày: ' + escHtml(nowStr) + ' • Số người: ' + state.peopleCount + '</div>' +
      '</div>' +
      '<table class="rcpt-table">' +
        '<thead><tr><th>#</th><th>Tên món / Mục</th><th class="num">SL</th><th class="num">Đơn giá</th><th class="num">Thành tiền</th></tr></thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
      '</table>' +
      '<div class="rcpt-summary">' +
        '<div class="rcpt-sum-row"><span>Tạm tính (' + state.items.length + ' mục):</span><span>' + fmtVnd(calc.subtotal) + '</span></div>' +
        (calc.discount > 0 ? '<div class="rcpt-sum-row"><span>Giảm giá:</span><span>−' + fmtVnd(calc.discount) + '</span></div>' : '') +
        (calc.vatAmt > 0 ? '<div class="rcpt-sum-row"><span>VAT / Phí dịch vụ (' + state.vat + '%):</span><span>+' + fmtVnd(calc.vatAmt) + '</span></div>' : '') +
        (calc.tipAmt > 0 ? '<div class="rcpt-sum-row"><span>Tiền Tip:</span><span>+' + fmtVnd(calc.tipAmt) + '</span></div>' : '') +
        '<div class="rcpt-sum-row grand"><span>TỔNG THANH TOÁN:</span><span>' + fmtVnd(calc.grandTotal) + '</span></div>' +
      '</div>' +
      '<div class="rcpt-split-box">' +
        '<div class="rcpt-split-title">👥 CHI TIẾT CHIA THEO ĐẦU NGƯỜI</div>' +
        splitHtml +
      '</div>';
  }

  function buildPlainReceiptText() {
    var calc = computeBill();
    var nowStr = new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    var lines = [];
    lines.push('🧾 HÓA ĐƠN CHI TIẾT — ' + (state.placeName || 'Bữa ăn Hà Nội Phố Vị'));
    lines.push('📅 Thời gian: ' + nowStr + ' | 👥 Số người: ' + state.peopleCount);
    lines.push('----------------------------------------');
    state.items.forEach(function (it, idx) {
      var lineTotal = (Number(it.qty) || 1) * (Number(it.price) || 0);
      var isSolo = it.split !== 'all' && parseInt(it.split, 10) >= 0 && parseInt(it.split, 10) < state.peopleCount;
      var tag = isSolo ? ' [Riêng: ' + getMemberName(parseInt(it.split, 10)) + ']' : '';
      lines.push((idx + 1) + '. ' + it.name + ' (' + it.qty + ' x ' + fmtVnd(it.price) + ') = ' + fmtVnd(lineTotal) + tag);
    });
    lines.push('----------------------------------------');
    lines.push('Tạm tính: ' + fmtVnd(calc.subtotal));
    if (calc.discount > 0) lines.push('Giảm giá: -' + fmtVnd(calc.discount));
    if (calc.vatAmt > 0) lines.push('VAT / Phí DV (' + state.vat + '%): +' + fmtVnd(calc.vatAmt));
    if (calc.tipAmt > 0) lines.push('Tiền Tip: +' + fmtVnd(calc.tipAmt));
    lines.push('💰 TỔNG CỘNG: ' + fmtVnd(calc.grandTotal));
    lines.push('----------------------------------------');
    lines.push('👥 CHIA THEO ĐẦU NGƯỜI:');
    if (!calc.hasPersonalItems) {
      var each = Math.round(calc.grandTotal / state.peopleCount);
      lines.push('• Mỗi người (' + state.peopleCount + ' người): ' + fmtVnd(each));
    } else {
      calc.perPerson.forEach(function (p) {
        lines.push('• ' + p.name + ': ' + fmtVnd(p.total));
      });
    }
    return lines.join('\n');
  }

  function copyBillText() {
    var txt = buildPlainReceiptText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () {
        showBillToast('Đã copy hóa đơn chi tiết vào bộ nhớ tạm!');
      }).catch(function () {
        showBillToast('Không thể truy cập clipboard.');
      });
    } else {
      showBillToast('Trình duyệt không hỗ trợ copy tự động.');
    }
  }

  function downloadBillPng() {
    var calc = computeBill();
    var nowStr = new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    var W = 560;
    var splitRowsCount = calc.hasPersonalItems ? calc.perPerson.length : 1;
    var H = 290 + Math.max(1, state.items.length) * 30 + splitRowsCount * 26 + 80;

    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fffefa';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#b99b76';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, W - 24, H - 24);

    var y = 44;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8c231e';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('HÀ NỘI PHỐ VỊ • HÓA ĐƠN CHIA BILL', W / 2, y);
    y += 24;
    ctx.fillStyle = '#1f1a16';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(state.placeName || 'Bữa ăn nhóm', W / 2, y);
    y += 20;
    ctx.fillStyle = '#6b5344';
    ctx.font = '13px sans-serif';
    ctx.fillText('Ngày: ' + nowStr + '  •  Số người: ' + state.peopleCount, W / 2, y);

    y += 18;
    ctx.strokeStyle = '#c8b294';
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(W - 28, y);
    ctx.stroke();
    ctx.setLineDash([]);

    y += 22;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5c402c';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Mục / Tên món', 28, y);
    ctx.textAlign = 'right';
    ctx.fillText('SL × Đơn giá', 405, y);
    ctx.fillText('Thành tiền', W - 28, y);
    y += 10;

    ctx.font = '14px sans-serif';
    if (!state.items.length) {
      y += 24;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8c735f';
      ctx.fillText('(Chưa có món nào)', W / 2, y);
    } else {
      state.items.forEach(function (it, idx) {
        y += 28;
        var lineTotal = (Number(it.qty) || 1) * (Number(it.price) || 0);
        var label = (idx + 1) + '. ' + it.name;
        if (label.length > 28) label = label.slice(0, 27) + '…';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#1f1a16';
        ctx.fillText(label, 28, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#6b5344';
        ctx.fillText(it.qty + ' × ' + fmtVnd(it.price), 405, y);
        ctx.fillStyle = '#1f1a16';
        ctx.fillText(fmtVnd(lineTotal), W - 28, y);
      });
    }

    y += 20;
    ctx.strokeStyle = '#c8b294';
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(W - 28, y);
    ctx.stroke();
    ctx.setLineDash([]);

    function drawSumRow(label, val, bold, col) {
      y += 24;
      ctx.textAlign = 'left';
      ctx.font = (bold ? 'bold 16px ' : '14px ') + 'sans-serif';
      ctx.fillStyle = col || '#1f1a16';
      ctx.fillText(label, 28, y);
      ctx.textAlign = 'right';
      ctx.fillText(val, W - 28, y);
    }

    drawSumRow('Tạm tính:', fmtVnd(calc.subtotal), false, '#5c402c');
    if (calc.discount > 0) drawSumRow('Giảm giá:', '-' + fmtVnd(calc.discount), false, '#5c402c');
    if (calc.vatAmt > 0) drawSumRow('VAT / Phí DV (' + state.vat + '%):', '+' + fmtVnd(calc.vatAmt), false, '#5c402c');
    if (calc.tipAmt > 0) drawSumRow('Tiền Tip:', '+' + fmtVnd(calc.tipAmt), false, '#5c402c');
    drawSumRow('TỔNG THANH TOÁN:', fmtVnd(calc.grandTotal), true, '#8c231e');

    y += 22;
    ctx.fillStyle = '#f0fdf4';
    ctx.fillRect(26, y, W - 52, 34 + splitRowsCount * 26);
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(26, y, W - 52, 34 + splitRowsCount * 26);

    y += 22;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#166534';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('CHI TIẾT CHIA THEO ĐẦU NGƯỜI', 38, y);

    ctx.font = 'bold 14px sans-serif';
    if (!calc.hasPersonalItems) {
      y += 24;
      var each = Math.round(calc.grandTotal / state.peopleCount);
      ctx.fillText('Mỗi người (' + state.peopleCount + ' người):', 38, y);
      ctx.textAlign = 'right';
      ctx.fillText(fmtVnd(each) + ' / người', W - 38, y);
    } else {
      calc.perPerson.forEach(function (p) {
        y += 24;
        ctx.textAlign = 'left';
        ctx.fillText(p.name, 38, y);
        ctx.textAlign = 'right';
        ctx.fillText(fmtVnd(p.total), W - 38, y);
      });
    }

    var link = document.createElement('a');
    link.download = 'hoa-don-chia-bill.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showBillToast('Đã tải ảnh hóa đơn (.PNG)!');
  }

  function openBillModal(prefillData) {
    populatePlaceSuggestions();
    if (prefillData && typeof prefillData === 'string') {
      state.placeName = prefillData;
      saveState();
    } else if (prefillData && typeof prefillData === 'object') {
      if (typeof prefillData.placeName === 'string' && prefillData.placeName.trim()) {
        state.placeName = prefillData.placeName.trim();
      }
      if (Array.isArray(prefillData.items)) {
        state.items = prefillData.items.map(function (it) {
          return {
            name: String((it && it.name) || 'Món ăn'),
            qty: Math.max(1, parseInt(it && it.qty, 10) || 1),
            price: Math.max(0, Number(it && it.price) || 0),
            split: (it && it.split !== undefined) ? it.split : 'all'
          };
        });
      }
      if (prefillData.directTotal !== undefined) {
        state.directTotal = Math.max(0, Number(prefillData.directTotal) || 0);
      }
      if (prefillData.discount !== undefined) {
        state.discount = Math.max(0, Number(prefillData.discount) || 0);
      }
      if (prefillData.vat !== undefined) {
        state.vat = Math.min(50, Math.max(0, Number(prefillData.vat) || 0));
      }
      if (prefillData.tip !== undefined) {
        state.tip = Math.max(0, Number(prefillData.tip) || 0);
      }
      saveState();
    }
    if ($('billPlaceName')) $('billPlaceName').value = state.placeName;
    if ($('billPeopleCount')) $('billPeopleCount').value = state.peopleCount;
    if ($('billDirectTotal')) $('billDirectTotal').value = fmtDots(state.directTotal);
    if ($('billDiscount')) $('billDiscount').value = fmtDots(state.discount);
    if ($('billVat')) $('billVat').value = state.vat;
    if ($('billTip')) $('billTip').value = fmtDots(state.tip);

    syncMemberControls();
    renderItemsList();
    renderReceipt();

    var modal = $('billSplitModal');
    if (modal) {
      modal.hidden = false;
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeBillModal() {
    var modal = $('billSplitModal');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  function initBillSplitter() {
    loadState();

    $('btnOpenBillHero')?.addEventListener('click', function () {
      openBillModal();
    });
    $('btnCloseBillModal')?.addEventListener('click', closeBillModal);
    $('billSplitModal')?.addEventListener('click', function (e) {
      if (e.target === $('billSplitModal')) closeBillModal();
    });

    $('billPlaceName')?.addEventListener('input', function (e) {
      state.placeName = e.target.value;
      saveState();
      renderReceipt();
    });

    function setPeopleCount(n) {
      state.peopleCount = Math.max(1, Math.min(50, parseInt(n, 10) || 1));
      if ($('billPeopleCount')) $('billPeopleCount').value = state.peopleCount;
      saveState();
      syncMemberControls();
      renderItemsList();
      renderReceipt();
    }

    $('btnBillPeopleDec')?.addEventListener('click', function () { setPeopleCount(state.peopleCount - 1); });
    $('btnBillPeopleInc')?.addEventListener('click', function () { setPeopleCount(state.peopleCount + 1); });
    $('billPeopleCount')?.addEventListener('change', function (e) { setPeopleCount(e.target.value); });

    $('billItemPrice')?.addEventListener('input', function () {
      formatMoneyEl($('billItemPrice'), true);
    });

    $('billAddItemForm')?.addEventListener('submit', function (e) {
      e.preventDefault();
      var nameEl = $('billItemName');
      var qtyEl = $('billItemQty');
      var priceEl = $('billItemPrice');
      var splitEl = $('billItemSplitMode');
      var name = nameEl ? nameEl.value.trim() : '';
      var qty = Math.max(1, parseInt(qtyEl ? qtyEl.value : '1', 10) || 1);
      var price = parseMoney(priceEl ? priceEl.value : '0');
      var split = splitEl ? splitEl.value : 'all';
      if (!name) return;

      state.items.push({ name: name, qty: qty, price: price, split: split });
      saveState();
      if (nameEl) { nameEl.value = ''; nameEl.focus(); }
      if (qtyEl) qtyEl.value = '1';
      if (priceEl) priceEl.value = '';
      renderItemsList();
      renderReceipt();
    });

    document.querySelectorAll('.bill-qchip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-name');
        var price = parseInt(btn.getAttribute('data-price') || '0', 10);
        state.items.push({ name: name, qty: 1, price: price, split: 'all' });
        saveState();
        renderItemsList();
        renderReceipt();
      });
    });

    ['billDirectTotal', 'billDiscount', 'billTip'].forEach(function (id) {
      $(id)?.addEventListener('input', function (e) {
        var val = formatMoneyEl(e.target, false);
        if (id === 'billDirectTotal') state.directTotal = val;
        else if (id === 'billDiscount') state.discount = val;
        else state.tip = val;
        saveState();
        renderReceipt();
      });
    });

    $('billVat')?.addEventListener('input', function (e) {
      state.vat = Math.min(50, Math.max(0, Number(e.target.value) || 0));
      saveState();
      renderReceipt();
    });

    $('btnCopyBillText')?.addEventListener('click', copyBillText);
    $('btnDownloadBillPng')?.addEventListener('click', downloadBillPng);
    $('btnPrintBill')?.addEventListener('click', function () { window.print(); });
    $('btnResetBill')?.addEventListener('click', function () {
      state.items = [];
      state.directTotal = 0;
      state.discount = 0;
      state.vat = 0;
      state.tip = 0;
      if ($('billDirectTotal')) { $('billDirectTotal').value = '0'; $('billDirectTotal').disabled = false; }
      if ($('billDiscount')) $('billDiscount').value = '0';
      if ($('billVat')) $('billVat').value = '0';
      if ($('billTip')) $('billTip').value = '0';
      saveState();
      renderItemsList();
      renderReceipt();
      showBillToast('Đã làm mới hóa đơn!');
    });
  }

  window.openBillSplitterForPlace = openBillModal;
  document.addEventListener('DOMContentLoaded', initBillSplitter);
})();
