// ===================== CONFIG =====================
const gallery = document.getElementById("gallery");
const loadingEl = document.getElementById("loading");
const endEl = document.getElementById("end");
const searchInput = document.getElementById("search");
const categoryBar = document.getElementById("categoryBar");

let page = 1;
let limit = 20;
let loading = false;
let totalPages = Infinity;
let currentImgs = [];
let currentFilter = { q: "", cat: "all" };
let isAdmin = false;
let currentOpenImg = null;

// Check admin
fetch("/admin/check")
  .then(r => r.json())
  .then(d => (isAdmin = d.isAdmin));

// Helper
const el = (tag, cls) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
};

// ===================== CARD =====================
function createCard(img) {
  const card = el("div", "card");

  const wrap = el("div", "thumb-wrap");
  const im = el("img", "thumb");
  im.src = img.url;

  im.onclick = () => openLightbox(img);
  wrap.appendChild(im);

  const p = el("button", "btn preview");
  p.innerText = "Preview";
  p.onclick = e => {
    e.stopPropagation();
    openLightbox(img);
  };
  wrap.appendChild(p);

  card.appendChild(wrap);

  const info = el("div", "info");
  info.innerHTML = `
    <div class="title">${img.albumTitle || ""}</div>
    <div class="meta">${img.albumLikesCount || 0} likes • ${img.albumViews || 0} views</div>
  `;
  card.appendChild(info);

  return card;
}

// ===================== LIGHTBOX =====================
function openLightbox(img) {
  console.log("OPENED IMAGE:", img);

  currentOpenImg = img;

  // 🔥 Fix missing albumId (root cause of 404)
  if (!img.albumId) {
    console.error("❌ albumId missing – cannot increment views/likes");
    return;
  }

  // ========== BUILD LINK SECTION ==========
  let linkHTML = "";

  if (img.watchLink) {
    linkHTML += `
      <div class="linkRow">
        🎬 <a href="${img.watchLink}" target="_blank">Watch Now</a>
      </div>`;
  }

  if (img.downloadLink) {
    linkHTML += `
      <div class="linkRow">
        ⬇️ <a href="${img.downloadLink}" target="_blank">Download</a>
      </div>`;
  }

  if (Array.isArray(img.extraLinks)) {
    img.extraLinks.forEach((lnk, i) => {
      linkHTML += `
        <div class="linkRow">
          🔗 <a href="${lnk}" target="_blank">Link ${i + 1}</a>
        </div>`;
    });
  }

  document.getElementById("lbLinks").innerHTML = linkHTML;

  // ========== INCREASE VIEW COUNT ==========
  fetch(`/api/view/album/${img.albumId}`, { method: "POST" })
    .then(r => r.json())
    .then(d => {
      if (d.views !== undefined) {
        document.getElementById("viewCount").innerText = d.views + " views";
      }
    })
    .catch(() => {});

  // ========== SHOW LIGHTBOX ==========
  document.getElementById("lbImage").src = img.url;
  document.getElementById("lbTitle").innerText = img.albumTitle || "";
  document.getElementById("lbDesc").innerText = img.albumDescription || "";

  document.getElementById("likeCount").innerText = img.albumLikesCount || 0;
  document.getElementById("viewCount").innerText =
    (img.albumViews || 0) + " views";

  document.getElementById("lightbox").classList.remove("hidden");
}

// Close Lightbox
document.getElementById("lbClose").onclick = () => {
  document.getElementById("lightbox").classList.add("hidden");
};

// ===================== LIKE BUTTON =====================
document.getElementById("likeBtn").onclick = () => {
  if (!currentOpenImg || !currentOpenImg.albumId) return;

  fetch(`/api/like/album/${currentOpenImg.albumId}`, { method: "POST" })
    .then(r => r.json())
    .then(d => {
      if (d.likes !== undefined) {
        document.getElementById("likeCount").innerText = d.likes;
      }
    })
    .catch(() => {});
};

// ===================== FETCH IMAGES =====================
async function fetchImages() {
  if (loading || page > totalPages) return;

  loading = true;
  loadingEl.style.display = "block";

  const res = await fetch(`/api/images?page=${page}&limit=${limit}`);
  const data = await res.json();

  totalPages = data.totalPages || 1;
  currentImgs = currentImgs.concat(data.images || []);

  gallery.innerHTML = "";
  currentImgs.forEach(img => gallery.appendChild(createCard(img)));

  loading = false;
  loadingEl.style.display = "none";
  page++;
}

// ===================== SEARCH =====================
document.getElementById("searchBtn").onclick = () => {
  currentFilter.q = searchInput.value.toLowerCase();
  page = 1;
  currentImgs = [];
  fetchImages();
};

// ===================== SCROLL =====================
window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    fetchImages();
  }
});

// Start
fetchImages();
