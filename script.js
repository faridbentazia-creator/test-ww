(() => {
  "use strict";

  const $ = (sel, root = document) => (root || document).querySelector(sel);
  const $$ = (sel, root = document) => Array.from((root || document).querySelectorAll(sel));

  const productGrid = $("#productGrid");
  let products = [];
  const searchInput = $("#productSearch");
  const categoryFilter = $("#categoryFilter");
  const emptyState = $("#emptyState");
  const cartOverlay = $("#cartOverlay");
  const cartItemsEl = $("#cartItems");
  const cartCountEl = $("#cartCount");
  const cartTotalEl = $("#cartTotal");
  const toast = $("#toast");

  const cart = new Map();
  let toastTimer;
  let previousBodyOverflow = "";
  let previouslyFocusedElement = null;
  let focusableInDialog = [];
  let focusTrapHandler = null;

  const CURRENCY = "دج";
  // صيغة واحدة لكل الأسعار في الموقع (بطاقات المنتجات، السلة، ملخص الطلب)
  const money = (amount) =>
    `${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${CURRENCY}`;

  function showToast(msg) {
    try {
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
    } catch (e) {
      console.error("showToast error:", e);
    }
  }

  function lockBodyScroll() {
    try {
      // احتفظ بالقيمة الأصلية مرة واحدة فقط؛ فتح نافذة فوق أخرى لا يجب أن يمحوها.
      if (document.body.style.overflow !== "hidden") {
        previousBodyOverflow = document.body.style.overflow || "";
      }
      document.body.style.overflow = "hidden";
    } catch (e) {
      console.error("lockBodyScroll error:", e);
    }
  }

  function unlockBodyScroll() {
    try {
      document.body.style.overflow = previousBodyOverflow || "";
      previousBodyOverflow = "";
    } catch (e) {
      console.error("unlockBodyScroll error:", e);
    }
  }

  function filterProducts() {
    try {
      const query = (searchInput?.value || "").trim().toLocaleLowerCase("ar");
      const category = categoryFilter?.value || "الكل";
      let visible = 0;

      products.forEach((product) => {
        const name = (product.dataset.name || "").toLocaleLowerCase("ar");
        const matchesQuery = name.includes(query) || (product.dataset.category || "").toLocaleLowerCase("ar").includes(query);
        const matchesCategory = category === "الكل" || product.dataset.category === category;
        const show = matchesQuery && matchesCategory;

        product.hidden = !show;
        if (show) visible += 1;
      });

      if (emptyState) emptyState.hidden = visible !== 0;
    } catch (e) {
      console.error("filterProducts error", e);
    }
  }

  function isCartEmpty() {
    return cart.size === 0;
  }

  function updateCart() {
    try {
      let count = 0;
      let total = 0;

      cart.forEach((item) => {
        count += item.quantity;
        total += item.price * item.quantity;
      });

      if (cartCountEl) cartCountEl.textContent = String(count);
      if (cartTotalEl) cartTotalEl.textContent = money(total);

      if (!cartItemsEl) return;

      if (isCartEmpty()) {
        cartItemsEl.innerHTML = '<p class="cart-empty">سلتكِ فارغة حالياً ♡</p>';
        return;
      }

      cartItemsEl.replaceChildren();

      cart.forEach((item, id) => {
        const row = document.createElement("div");
        row.className = "cart-row";

        const details = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = item.name;

        const unitPrice = document.createElement("p");
        unitPrice.textContent = `${money(item.price)} للقطعة`;

        const controls = document.createElement("div");
        controls.className = "quantity-controls";

        const decrease = document.createElement("button");
        decrease.type = "button";
        decrease.textContent = "−";
        decrease.setAttribute("aria-label", `تقليل كمية ${item.name}`);
        decrease.addEventListener("click", () => changeQuantity(id, -1));

        const quantity = document.createElement("span");
        quantity.textContent = String(item.quantity);
        quantity.setAttribute("aria-label", "الكمية");

        const increase = document.createElement("button");
        increase.type = "button";
        increase.textContent = "+";
        increase.setAttribute("aria-label", `زيادة كمية ${item.name}`);
        increase.addEventListener("click", () => changeQuantity(id, 1));

        controls.append(decrease, quantity, increase);
        details.append(title, unitPrice, controls);

        const subtotal = document.createElement("strong");
        subtotal.className = "cart-row-price";
        subtotal.textContent = money(item.price * item.quantity);

        row.append(details, subtotal);
        cartItemsEl.append(row);
      });
    } catch (e) {
      console.error("updateCart error:", e);
    }
  }

  function changeQuantity(id, delta) {
    try {
      const item = cart.get(id);
      if (!item) return;

      item.quantity += delta;

      if (item.quantity <= 0) {
        cart.delete(id);
      }

      updateCart();
    } catch (e) {
      console.error("changeQuantity error:", e);
    }
  }

  function addToCart(product) {
    try {
      if (!product) return;

      let id = product.dataset.id;
      if (!id) {
        const safeName = (product.dataset.name || "").replace(/\s+/g, "_").slice(0, 40);
        const price = String(product.dataset.price || "0");
        id = `${safeName}::${price}`;
        product.dataset.id = id;
      }

      const current = cart.get(id);

      if (current) {
        current.quantity += 1;
      } else {
        cart.set(id, {
          id: product.dataset.id,
          name: product.dataset.name || "منتج",
          price: Number(product.dataset.price) || 0,
          quantity: 1
        });
      }

      updateCart();
      showToast(`تمت إضافة «${product.dataset.name}» إلى سلتكِ`);
    } catch (e) {
      console.error("addToCart error:", e);
    }
  }

  function getFocusableElements(root) {
    const selectors = 'a[href], area[href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll(selectors)).filter((el) => {
      try {
        return el.offsetParent !== null || el.getClientRects().length > 0;
      } catch {
        return false;
      }
    });
  }

  function enableFocusTrap(dialog) {
    focusableInDialog = getFocusableElements(dialog);
    focusTrapHandler = function (e) {
      if (e.key !== "Tab") return;

      if (focusableInDialog.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusableInDialog[0];
      const last = focusableInDialog[focusableInDialog.length - 1];

      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", focusTrapHandler);
  }

  function disableFocusTrap() {
    if (focusTrapHandler) {
      document.removeEventListener("keydown", focusTrapHandler);
      focusTrapHandler = null;
    }
    focusableInDialog = [];
  }

  function openCart() {
    try {
      if (!cartOverlay) return;

      previouslyFocusedElement = document.activeElement;
      cartOverlay.hidden = false;
      lockBodyScroll();

      const drawer = cartOverlay.querySelector(".cart-drawer");
      if (drawer) {
        const closeBtn = drawer.querySelector("#cartClose");
        enableFocusTrap(drawer);
        if (closeBtn) closeBtn.focus();
        else drawer.focus();
      }
    } catch (e) {
      console.error("openCart error:", e);
    }
  }

  function closeCart() {
    try {
      if (cartOverlay) cartOverlay.hidden = true;

      unlockBodyScroll();
      disableFocusTrap();

      if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === "function") {
        previouslyFocusedElement.focus();
      } else {
        $("#cartOpen")?.focus();
      }
    } catch (e) {
      console.error("closeCart error:", e);
    }
  }

  try {
    if (searchInput) searchInput.addEventListener("input", filterProducts);
    if (categoryFilter) {
      categoryFilter.addEventListener("change", () => {
        $$(".category-card").forEach((button) => {
          button.classList.toggle("selected", button.dataset.category === categoryFilter.value);
        });
        filterProducts();
      });
    }

    const supportedCategories = ["العطور", "المكياج", "العناية بالبشرة", "العناية بالشعر"];

    $$(".category-card").forEach((button) => {
      button.addEventListener("click", () => {
        const category = button.dataset.category;
        categoryFilter.value = supportedCategories.includes(category) ? category : "الكل";
        // عند اختيار قسم من "اكتشفي عالم الجمال"، امسح البحث السابق
        // حتى لا يمنع ظهور منتجات القسم بسبب كلمة بحث قديمة.
        if (searchInput) searchInput.value = "";

        $$(".category-card").forEach((card) => {
          card.classList.toggle("selected", card === button);
        });

        filterProducts();
        $("#products")?.scrollIntoView({ behavior: "smooth" });
      });
    });

    // تفويض الأحداث: البطاقات تُنشأ ديناميكياً من Supabase
    productGrid?.addEventListener("click", (e) => {
      const add = e.target.closest(".add-to-cart");
      if (add && !add.disabled) {
        const card = add.closest(".product-card");
        if (card) addToCart(card);
        return;
      }
      const fav = e.target.closest(".favorite-btn");
      if (fav) {
        const active = fav.classList.toggle("is-favorite");
        fav.textContent = active ? "♥" : "♡";
        showToast(active ? "أُضيف المنتج إلى مفضلتكِ" : "أُزيل المنتج من مفضلتكِ");
      }
    });

    $("#cartOpen")?.addEventListener("click", openCart);
    $("#cartClose")?.addEventListener("click", closeCart);
    $("#cartCloseBackdrop")?.addEventListener("click", closeCart);

  } catch (e) {
    console.error("listener setup error:", e);
  }

  /* ===== تكامل استمارة الطلب ===== */
  /* ===== Supabase ===== */
  // المفتاح العام (publishable) آمن للعرض في المتصفح؛ الحماية تتم عبر RLS في قاعدة البيانات.
  const SUPABASE_URL = "https://bbrwbdegsoixpgussuyo.supabase.co";
  const SUPABASE_KEY = "sb_publishable_HIMfT4Uk91rVnH2oRGs3bA_jUGTNL6z";

  async function saveOrderToSupabase(order) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(order),
        signal: controller.signal
      });

      if (!res.ok) {
        console.error("Supabase insert failed:", res.status, await res.text());
        return false;
      }
      return true;
    } catch (err) {
      console.error("Supabase insert error:", err);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildOrderFromCart() {
    const items = [];
    try {
      cart.forEach((it) => {
        items.push({
          id: it.id,
          name: it.name,
          price: Number(it.price || 0),
          quantity: Number(it.quantity || 1)
        });
      });
    } catch (e) {
      console.error("buildOrderFromCart error:", e);
    }
    return items;
  }

  function renderOrderSummary(items) {
    const container = document.getElementById("orderSummary");
    if (!container) return;

    if (!items || !items.length) {
      container.innerHTML = '<div class="summary-row">السلة فارغة — أضيفي منتجات أولًا.</div>';
      return;
    }

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    container.innerHTML =
      '<b>🛍️ ملخص طلبك</b>' +
      items.map((item) =>
        `<div class="summary-row">
          <span>${escapeHtml(item.name)} × ${item.quantity}</span>
          <span>${money(item.price * item.quantity)}</span>
        </div>`
      ).join("") +
      `<div class="summary-row summary-total"><span>المجموع</span><span>${money(total)}</span></div>`;
  }

  function openOrderPage() {
    const page = document.getElementById("orderPage");
    if (!page) return;

    const items = buildOrderFromCart();
    if (!items.length) {
      showToast("السلة فارغة — أضيفي منتجًا أولًا.");
      return;
    }

    renderOrderSummary(items);

    previouslyFocusedElement = document.activeElement;
    // استخدم فئة .open بدل ضبط inline style ليكون أكثر موثوقية
    page.classList.add("open");
    page.setAttribute("aria-hidden", "false");
    lockBodyScroll();

    const dialog = page.querySelector(".order-card");
    if (dialog) {
      // تأمين تركيز بسيط بعد العرض لتجنّب مشاكل المتصفحات
      setTimeout(() => {
        const first = dialog.querySelector('input:not([type="hidden"]), textarea, button:not([disabled])');
        if (first) first.focus();
        else dialog.focus();
      }, 40);

      enableFocusTrap(dialog);
    }

    // استماع محليّ للنقرات داخل صفحة الطلب (خلفية أو زر الإغلاق)
    page.addEventListener("click", orderPageClickHandler);
  }

  function orderPageClickHandler(ev) {
    // إذا نقر المستخدم على backdrop أو على زر بعلامة data-close-order → أغلق
    if (ev.target === document.getElementById("orderPage") ||
        ev.target.classList.contains("order-backdrop") ||
        ev.target.closest("[data-close-order]")) {
      closeOrderPage();
    }
  }

  function closeOrderPage() {
    const page = document.getElementById("orderPage");
    if (!page) return;

    page.classList.remove("open");
    page.setAttribute("aria-hidden", "true");
    unlockBodyScroll();
    disableFocusTrap();

    try {
      page.removeEventListener("click", orderPageClickHandler);
    } catch {}

    try {
      if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === "function") {
        previouslyFocusedElement.focus();
      } else {
        $("#cartOpen")?.focus();
      }
    } catch (e) {
      // ignore
    }
  }

  // العودة من الاستمارة إلى السلة دون إغلاق الموقع أو تعطيل التمرير لاحقًا.
  function returnToCart() {
    const page = document.getElementById("orderPage");
    if (page) {
      page.classList.remove("open");
      page.setAttribute("aria-hidden", "true");
      page.removeEventListener("click", orderPageClickHandler);
    }

    disableFocusTrap();

    if (cartOverlay) {
      cartOverlay.hidden = false;
      const drawer = cartOverlay.querySelector(".cart-drawer");
      if (drawer) {
        enableFocusTrap(drawer);
        (drawer.querySelector("#checkoutBtn") || drawer).focus();
      }
    } else {
      unlockBodyScroll();
    }
  }

  // توحيد التعامل مع نقرات بسيطة (سابقاً كانت موجودة، أبقيت معالجة مستقرة)
  document.addEventListener("click", (ev) => {
    const closeBtn = ev.target.closest(".close-order");
    if (closeBtn) {
      closeOrderPage();
      return;
    }

    const backBtn = ev.target.closest("#backOrderBtn");
    if (backBtn) {
      ev.preventDefault();
      returnToCart();
      return;
    }

    const backdrop = ev.target.closest("[data-close-order]");
    if (backdrop && backdrop.classList.contains("order-backdrop")) {
      closeOrderPage();
      return;
    }
  });

  let isSubmittingOrder = false;

  document.getElementById("customerForm")?.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (isSubmittingOrder) return;

    const items = buildOrderFromCart();
    if (!items.length) {
      alert("السلة فارغة.");
      closeOrderPage();
      return;
    }

    const nameEl = document.getElementById("customerName");
    const phoneEl = document.getElementById("customerPhone");
    const wilayaEl = document.getElementById("customerWilaya");
    const addressEl = document.getElementById("customerAddress");

    if (!nameEl || !phoneEl || !wilayaEl || !addressEl) {
      alert("خطأ في نموذج الطلب.");
      return;
    }

    const name = nameEl.value.trim();
    const phone = phoneEl.value.trim();
    const wilaya = wilayaEl.value.trim();
    const address = addressEl.value.trim();

    if (!name || !phone || !wilaya || !address) {
      alert("يرجى ملء جميع الحقول.");
      return;
    }

    isSubmittingOrder = true;
    const submitBtn = document.getElementById("submitOrder");
    const originalLabel = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "جارٍ إرسال الطلب...";
    }

    const saved = await saveOrderToSupabase({
      customer_name: name,
      customer_phone: phone,
      shipping_wilaya: wilaya,
      shipping_address: address,
      // الخادم يعيد حساب السعر والاسم من جدول products؛ المهم هنا id والكمية فقط.
      product: items.map((item) => ({
        id: Number(item.id),
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }))
    });

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
    isSubmittingOrder = false;

    if (!saved) {
      // نُبقي السلة والبيانات كما هي ليعيد الزبون المحاولة دون إعادة الكتابة.
      showToast("تعذّر إرسال الطلب. تحقّقي من الاتصال وحاولي مرة أخرى.");
      return;
    }

    cart.clear();
    updateCart();
    e.target.reset();
    closeOrderPage();
    showToast("تم استلام طلبك بنجاح ✓ سنتواصل معكِ قريباً.");
  });

  const checkoutBtnLocal = document.getElementById("checkoutBtn");
  if (checkoutBtnLocal) {
    checkoutBtnLocal.addEventListener("click", (ev) => {
      ev.preventDefault();

      if (isCartEmpty()) {
        showToast("أضيفي منتجًا إلى السلة أولاً.");
        return;
      }

      const overlay = document.getElementById("cartOverlay");
      if (overlay) overlay.hidden = true;

      openOrderPage();
    });
  }

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      const page = document.getElementById("orderPage");
      if (page && page.classList.contains("open")) {
        closeOrderPage();
        return;
      }

      if (cartOverlay && !cartOverlay.hidden) {
        closeCart();
      }
    }
  });

  $("#searchFocus")?.addEventListener("click", () => {
    $("#products")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => searchInput?.focus(), 350);
  });

  $("#menuToggle")?.addEventListener("click", () => {
    const nav = $("#mainNav");
    const open = nav?.classList.toggle("open");
    $("#menuToggle")?.setAttribute("aria-expanded", String(Boolean(open)));
  });

  $$("#mainNav a").forEach((link) => {
    link.addEventListener("click", () => {
      $("#mainNav")?.classList.remove("open");
      $("#menuToggle")?.setAttribute("aria-expanded", "false");
    });
  });

  $("#newsletterForm")?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const email = $("#email");
    const message = $("#newsletterMessage");

    if (!email || !email.checkValidity()) {
      email?.reportValidity?.();
      return;
    }

    message.textContent = "شكراً لاشتراككِ! هذه نسخة تجريبية، ولم يتم حفظ بريدكِ.";
    email.value = "";
  });

  $("#showAll")?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (categoryFilter) categoryFilter.value = "الكل";

    $$(".category-card").forEach((card) => card.classList.remove("selected"));
    filterProducts();
    showToast("أنتِ تشاهدين جميع المنتجات المتاحة حالياً");
  });

  /* ===== تحميل المنتجات من Supabase ===== */
  const escHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function productCard(p, reserveRating) {
    const sale = p.discount_price != null && Number(p.discount_price) < Number(p.price);
    const price = sale ? Number(p.discount_price) : Number(p.price);
    const out = p.quantity != null && p.quantity <= 0;
    const label = out ? "نفدت الكمية" : p.badge === "bestseller" ? "الأكثر مبيعاً" : p.badge === "new" ? "جديد" : p.badge === "good" ? "جيد" : sale ? "تخفيض" : "";
    return `<article class="product-card" data-id="${escHtml(p.id)}" data-name="${escHtml(p.name)}"
        data-category="${escHtml(p.category || "")}" data-price="${price}">
      <div class="product-photo photo-cream">
        ${label ? `<span class="product-label ${p.badge === "new" && !out ? "new-label" : ""}">${label}</span>` : ""}
        <button class="favorite-btn" aria-label="إضافة للمفضلة">♡</button>
        ${p.image ? `<img src="${escHtml(p.image)}" alt="${escHtml(p.name)}" loading="lazy" onerror="this.style.visibility='hidden'">` : ""}
      </div>
      <div class="product-info">
        <p class="product-category">${escHtml(p.category || "")}</p>
        <h3>${escHtml(p.name)}</h3>
        <p class="product-desc">${escHtml(p.description || "")}</p>
        ${!p.show_rating && reserveRating ? `<div class="rating" aria-hidden="true"></div>` : ""}${p.show_rating ? `<div class="rating" aria-label="تقييم ${Number(p.rating)} من 5">${"★".repeat(Math.round(p.rating))}${"☆".repeat(5 - Math.round(p.rating))}${p.rating_count > 0 ? ` <span>(${Number(p.rating_count)})</span>` : ""}</div>` : ""}
        <div class="product-bottom">
          <div class="price-box"><strong>${money(price)}</strong>${sale ? `<s class="old-price">${money(p.price)}</s>` : ""}</div>
          <button class="add-to-cart" ${out ? "disabled" : ""}>${out ? "غير متوفر" : `أضيفي إلى السلة <span>＋</span>`}</button>
        </div>
      </div>
    </article>`;
  }

  async function loadProducts() {
    if (!productGrid) return;
    productGrid.innerHTML = `<p class="grid-note">جارٍ تحميل المنتجات...</p>`;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&status=eq.active&order=sort_order.asc,created_at.desc`, {
        headers: { apikey: SUPABASE_KEY }
      });
      if (!res.ok) throw new Error(res.status);
      const list = await res.json();
      const anyRating = list.some((p) => p.show_rating);
      productGrid.innerHTML = list.map((p) => productCard(p, anyRating)).join("");
      products = $$(".product-card", productGrid);
      filterProducts();
      if (!list.length && emptyState) emptyState.hidden = false;
    } catch (err) {
      console.error("loadProducts error:", err);
      productGrid.innerHTML = `<p class="grid-note">تعذّر تحميل المنتجات. تحقّقي من الاتصال ثم أعيدي تحميل الصفحة.</p>`;
    }
  }

  /* ===== الهيدر الزجاجي: يزداد وضوحاً قليلاً عند التمرير ===== */
  const siteHeader = $(".site-header");
  const onHeaderScroll = () => siteHeader?.classList.toggle("is-scrolled", window.scrollY > 12);
  window.addEventListener("scroll", onHeaderScroll, { passive: true });
  onHeaderScroll();

  /* ===== الوضع الداكن ===== */
  const root = document.documentElement;
  const themeBtn = $("#themeToggle");
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme, save) {
    root.dataset.theme = theme;
    const dark = theme === "dark";
    themeBtn?.setAttribute("aria-pressed", String(dark));
    themeBtn?.setAttribute("aria-label", dark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن");
    themeMeta?.setAttribute("content", dark ? "#0f0b0d" : "#c83d70");
    if (save) { try { localStorage.setItem("nb_theme", theme); } catch (e) {} }
  }

  applyTheme(root.dataset.theme === "dark" ? "dark" : "light");

  themeBtn?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.classList.add("theme-anim");
    applyTheme(next, true);
    setTimeout(() => root.classList.remove("theme-anim"), 450);
    showToast(next === "dark" ? "تم تفعيل الوضع الداكن" : "تم تفعيل الوضع الفاتح");
  });

  $("#year") && ($("#year").textContent = String(new Date().getFullYear()));
  updateCart();
  loadProducts();

})();