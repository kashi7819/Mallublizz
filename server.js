require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const cors = require("cors");
const session = require("express-session");
const { Types } = mongoose;

// -------------------- APP SETUP --------------------
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ PUBLIC FOLDER STATIC SERVE
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "keyboardcat",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

// -------------------- CLOUDINARY --------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// -------------------- MONGO CONNECT --------------------
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// -------------------- SCHEMAS --------------------
const ImageSubSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    url: String,
    public_id: String,
    likes: { type: [String], default: [] },
    views: { type: Number, default: 0 },
  },
  { _id: false }
);

const AlbumSchema = new mongoose.Schema({
  title: String,
  description: String,
  category: String,
  tags: [String],
  images: [ImageSubSchema],
  watchLink: String,
  downloadLink: String,
  extraLinks: [String],
  likes: [String],
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const Album = mongoose.model("Album", AlbumSchema);

const SettingsSchema = new mongoose.Schema({
  adminPin: String,
  siteName: { type: String, default: "Photo Site" },
  categories: { type: [String], default: [] },
});

const Settings = mongoose.model("Settings", SettingsSchema);

async function getSettingsDoc() {
  let s = await Settings.findOne();
  if (!s) {
    s = await Settings.create({
      adminPin: process.env.ADMIN_PIN || "1234567",
      siteName: process.env.SITE_NAME || "Photo Site",
      categories: [],
    });
  }
  return s;
}

// -------------------- MULTER CLOUDINARY --------------------
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "photo_site_albums",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "mp4", "webm"],
  },
});

const upload = multer({ storage });

// -------------------- HELPERS --------------------
function getIP(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return xf.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "unknown";
}

function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  res.status(401).json({ error: "Unauthorized" });
}

// -------------------- DMCA ROUTE (IMPORTANT FIX) --------------------
app.get("/dmca", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dmca.html"));
});

// -------------------- FRONTEND --------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

app.get("/admin/dashboard", requireAdmin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html"))
);

// -------------------- API ROUTES --------------------
app.post("/api/upload", upload.array("photos", 100), async (req, res) => {
  try {
    const tags = (req.body.tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const images = req.files.map((f) => ({
      id: new Types.ObjectId().toString(),
      url: f.path,
      public_id: f.filename || f.public_id || "",
      likes: [],
      views: 0,
    }));

    const album = await Album.create({
      title: req.body.title || "",
      description: req.body.description || "",
      category: req.body.category || "",
      tags,
      images,
      watchLink: req.body.watchLink || "",
      downloadLink: req.body.downloadLink || "",
      extraLinks: (req.body.extraLinks || "")
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
      likes: [],
      views: 0,
    });

    res.json({ success: true, album });
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

// -------------------- GET ALBUMS --------------------
app.get("/api/albums", async (req, res) => {
  try {
    const albums = await Album.find().sort({ createdAt: -1 }).lean();
    res.json({ albums });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

// -------------------- GET IMAGES --------------------
app.get("/api/images", async (req, res) => {
  try {
    const albums = await Album.find().lean();
    let allImages = [];

    albums.forEach((album) => {
      album.images.forEach((img, index) => {
        allImages.push({
          imageId: img.id,
          url: img.url,
          public_id: img.public_id,
          imageLikesCount: img.likes.length,
          imageViews: img.views,
          albumId: album._id.toString(),
          albumTitle: album.title,
          albumCategory: album.category,
          albumLikesCount: album.likes.length,
          albumViews: album.views,
          watchLink: album.watchLink || "",
          downloadLink: album.downloadLink || "",
          extraLinks: album.extraLinks || [],
          index,
        });
      });
    });

    res.json({ success: true, images: allImages });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

// -------------------- ADMIN LOGIN --------------------
app.post("/admin/login", async (req, res) => {
  const settings = await getSettingsDoc();

  if (req.body.pin === settings.adminPin) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }

  res.json({ success: false, message: "Wrong PIN" });
});

app.get("/admin/check", (req, res) =>
  res.json({ isAdmin: req.session?.isAdmin === true })
);

app.post("/admin/logout", (req, res) =>
  req.session.destroy(() => res.json({ success: true }))
);

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT", PORT);
});
