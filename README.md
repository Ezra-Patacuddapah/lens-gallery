# LENS. | Modern Minimalist Gallery

A high-performance, mobile-first image gallery built with **Next.js 14**, **Tailwind CSS**, and **Supabase**. Featuring a seamless administrative interface, global search, and an immersive lightbox experience.



---

## ✨ Features

### 📸 Immersive Viewing
* **Global Slideshow:** View all filtered images in a high-speed, hardware-accelerated lightbox.
* **Coordinate Zoom:** Precise click-to-zoom functionality that centers on the exact coordinates of your cursor.
* **Thumbnail Strip:** Quick-access navigation bar within the slideshow that auto-scrolls to the active image.
* **Keyboard Shortcuts:** Navigate with `Arrows`, exit with `Esc`.

### 🛠 Administrative Suite
* **Mobile-First Actions:** Dedicated admin view with touch-friendly edit and delete controls.
* **Dynamic Uploads:** Direct-to-storage image uploading with instant gallery refresh.
* **Caption Management:** Easy-to-use modal with "Clear Input" helpers and full CRUD capabilities.

### 🔍 Performance & UI
* **Hybrid Search:** Global search bar accessible via Portals for consistent placement across layouts.
* **Responsive Grid:** Fluid column scaling from mobile (1 col) to 2K monitors (6 cols).
* **Smart Pagination:** Efficient data fetching using Supabase range queries to keep load times near-instant.

---

## 🚀 Tech Stack

| Technology | Purpose |
| :--- | :--- |
| **Next.js 14** | App Router, Server Components & Client Portals |
| **Supabase** | PostgreSQL Database & Cloud Storage |
| **Tailwind CSS** | Mobile-first utility styling |
| **HeroIcons** | SVG Icon System |
| **Lucide React** | Supplemental UI elements |

---

## 🛠 Setup & Installation

### 1. Clone the repository
```bash
git clone [https://github.com/your-username/lens-gallery.git](https://github.com/your-username/lens-gallery.git)
cd lens-gallery


lens-gallery/
├── app/
│   ├── layout.tsx          # Root layout with fonts/global CSS
│   ├── globals.css         # Tailwind styles
│   └── page.tsx            # Main Gallery "Controller" page
├── components/             # Modular UI Components
│   ├── admin/
│   │   └── AdminModal.tsx  # Upload/Update logic & form
│   ├── gallery/
│   │   ├── Grid.tsx        # Image grid & Skeleton state
│   │   ├── Lightbox.tsx    # Slideshow & Zoom logic
│   │   └── Pagination.tsx  # Responsive page controls
│   └── ui/
│       └── SearchBar.tsx   # Portal-based search input
├── hooks/
│   └── useWindowSize.ts    # Logic for responsive PAGE_SIZE
├── lib/
│   ├── supabase.ts         # Supabase client initialization
│   └── utils.ts            # Image path extraction & sanitization
└── types/
    └── index.ts            # Shared TypeScript interfaces



types/index.ts

export interface Post {
  id: string;
  image_url: string;
  caption: string;
  created_at?: string;
}

export interface GalleryProps {
  isAdmin: boolean;
}


lib/utils.ts

/**
 * Safely extracts a filename from a Supabase URL for deletion
 */
export const getFileNameFromUrl = (url: string): string | null => {
  const bucketId = "/public/images/";
  const parts = url.split(bucketId);
  return parts.length >= 2 ? decodeURIComponent(parts[1]) : null;
};

/**
 * Creates a unique, URL-friendly filename
 */
export const sanitizeFileName = (file: File): string => {
  return `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
};


components/gallery/Grid.tsx

import Image from "next/image";
import { PhotoIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Post } from "@/types";

export default function Grid({ posts, loading, isAdmin, onEdit, onDelete, onSelect, allPosts }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="aspect-square bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center">
            <PhotoIcon className="h-8 w-8 text-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
      {posts.map((post) => (
        <div key={post.id} className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-lg transition-all">
          <div onClick={() => onSelect(allPosts.findIndex(p => p.id === post.id))} className="relative aspect-square overflow-hidden cursor-zoom-in">
            <Image src={post.image_url} alt="" fill className="object-cover transition-transform duration-500 md:group-hover:scale-105" />
            {isAdmin && (
               <div className="absolute bottom-2 right-2 flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                 <button onClick={(e) => {e.stopPropagation(); onEdit(post);}} className="p-2 bg-white/90 rounded-lg text-blue-600 hover:bg-white cursor-pointer"><PencilSquareIcon className="h-4 w-4"/></button>
                 <button onClick={(e) => {e.stopPropagation(); onDelete(post.id, post.image_url);}} className="p-2 bg-white/90 rounded-lg text-red-500 hover:bg-white cursor-pointer"><TrashIcon className="h-4 w-4"/></button>
               </div>
            )}
          </div>
          <div className="p-4 font-bold text-xs truncate text-slate-500">{post.caption}</div>
        </div>
      ))}
    </div>
  );
}

/lib/supabase.ts

import { createClient } from '@supabase/supabase-api';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/components/admin/AdminModal.tsx

"use client";
import { useRef } from "react";
import Image from "next/image";
import { XMarkIcon, BackspaceIcon } from "@heroicons/react/24/outline";
import { Post } from "@/types";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (file: File | null, caption: string) => void;
  isSaving: boolean;
  caption: string;
  setCaption: (val: string) => void;
  editingPost: Post | null;
  clearForm: () => void;
}

export default function AdminModal({ 
  isOpen, onClose, onSave, isSaving, caption, setCaption, editingPost, clearForm 
}: AdminModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black">{editingPost ? "Update Entry" : "New Post"}</h2>
          <button onClick={clearForm} className="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full cursor-pointer hover:bg-red-100">
            <BackspaceIcon className="h-3 w-3 inline mr-1" />Reset
          </button>
        </div>

        {editingPost && (
          <div className="mb-4 relative h-32 w-full rounded-2xl overflow-hidden border-2 border-slate-100 bg-slate-50">
            <Image src={editingPost.image_url} alt="Current" fill className="object-cover opacity-50" />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-500 bg-white/60 uppercase">Existing Photo</div>
          </div>
        )}
        
        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-2">{editingPost ? "Change Image (Optional)" : "Select Image *"}</label>
        <input type="file" ref={fileInputRef} accept="image/*" className="mb-6 text-xs block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 cursor-pointer" />
        
        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-2">Caption *</label>
        <div className="relative mb-8">
          <input type="text" placeholder="Caption..." value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full p-4 pr-12 bg-slate-100 rounded-2xl outline-none border-2 border-transparent focus:border-blue-50 transition-all" />
          {caption && <button onClick={() => setCaption("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"><XMarkIcon className="h-4 w-4" /></button>}
        </div>

        <div className="flex gap-4">
          <button onClick={onClose} className="flex-1 font-bold text-slate-400 cursor-pointer">Cancel</button>
          <button 
            onClick={() => onSave(fileInputRef.current?.files?.[0] || null, caption)} 
            disabled={isSaving} 
            className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold cursor-pointer hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {isSaving ? "Saving..." : editingPost ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/components/gallery/Lightbox.tsx

"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { Post } from "@/types";

interface LightboxProps {
  index: number;
  items: Post[];
  onClose: () => void;
  setIndex: (i: number) => void;
}

export default function Lightbox({ index, items, onClose, setIndex }: LightboxProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState("center");
  const thumbStripRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    thumbStripRef.current[index]?.scrollIntoView({ behavior: "smooth", inline: "center" });
  }, [index]);

  const move = (dir: number) => {
    setIsZoomed(false);
    const next = index + dir;
    if (next >= 0 && next < items.length) setIndex(next);
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-between py-6 animate-in fade-in duration-300">
      <div className="w-full px-6 flex justify-between items-center z-[520]">
        <div className="text-white/40 text-[10px] font-mono">{index + 1} / {items.length}</div>
        <button onClick={onClose} className="p-2 text-white/60 bg-white/10 rounded-full cursor-pointer hover:text-white transition-colors"><XMarkIcon className="h-6 w-6" /></button>
      </div>

      <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden">
        <button onClick={() => move(-1)} className="absolute left-4 z-[510] text-white/30 p-4 hover:text-white cursor-pointer"><ChevronLeftIcon className="h-10 w-10"/></button>
        
        <div className="relative h-full w-full flex items-center justify-center overflow-hidden" style={{ cursor: isZoomed ? 'zoom-out' : 'zoom-in' }}>
          <Image 
            src={items[index].image_url} alt="" fill 
            className="object-contain transition-transform duration-500 ease-in-out will-change-transform"
            style={{ transform: isZoomed ? 'scale(2.5)' : 'scale(1)', transformOrigin: zoomOrigin }} 
            onClick={(e) => {
              if(!isZoomed) {
                const { left, top, width, height } = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setZoomOrigin(`${((e.clientX - left) / width) * 100}% ${((e.clientY - top) / height) * 100}%`);
              }
              setIsZoomed(!isZoomed);
            }}
          />
        </div>

        <button onClick={() => move(1)} className="absolute right-4 z-[510] text-white/30 p-4 hover:text-white cursor-pointer"><ChevronRightIcon className="h-10 w-10"/></button>
      </div>

      <div className="w-full max-w-4xl px-4 mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {items.map((thumb, tIdx) => (
          <div 
            key={thumb.id} 
            ref={(el) => { thumbStripRef.current[tIdx] = el; }}
            onClick={() => {setIndex(tIdx); setIsZoomed(false);}} 
            className={`relative h-14 w-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${index === tIdx ? "border-blue-500 scale-110" : "border-transparent opacity-40 hover:opacity-100"}`}
          >
            <Image src={thumb.image_url} alt="" fill className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

app/page.tsx

"use client";
import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { supabase } from "@/lib/supabase";
import { Post } from "@/types";

// Import Modular Components
import Grid from "@/components/gallery/Grid";
import Lightbox from "@/components/gallery/Lightbox";
import Pagination from "@/components/gallery/Pagination";
import AdminModal from "@/components/admin/AdminModal";
import SearchBar from "@/components/ui/SearchBar";
import { PlusIcon } from "@heroicons/react/24/outline";

export default function GalleryPage({ isAdmin = false }: { isAdmin?: boolean }) {
  // --- RESPONSIVE PAGE SIZE ---
  const [pageSize, setPageSize] = useState(12);
  useEffect(() => {
    const updateSize = () => {
      if (window.innerWidth < 640) setPageSize(6);
      else if (window.innerWidth < 1024) setPageSize(8);
      else if (window.innerWidth < 1536) setPageSize(12);
      else setPageSize(18);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // --- STATE ---
  const [posts, setPosts] = useState<Post[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [slideshowIdx, setSlideshowIdx] = useState<number | null>(null);
  
  // Admin State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [caption, setCaption] = useState("");
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  // --- DATA FETCHING ---
  useEffect(() => {
    setHasMounted(true);
    fetchData();
    fetchAllForSlideshow();

    const channel = supabase.channel('realtime-gallery')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchData();
        fetchAllForSlideshow();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [search, page, pageSize]);

  async function fetchData() {
    setLoading(true);
    let query = supabase.from("posts").select("*", { count: "exact" });
    if (search) query = query.ilike("caption", `%${search}%`);
    const { data, count } = await query
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    setPosts(data || []);
    setTotal(count || 0);
    setLoading(false);
  }

  async function fetchAllForSlideshow() {
    let query = supabase.from("posts").select("id, image_url, caption");
    if (search) query = query.ilike("caption", `%${search}%`);
    const { data } = await query.order("created_at", { ascending: false });
    setAllPosts(data || []);
  }

  // --- HANDLERS ---
  const handleSave = async (file: File | null, currentCaption: string) => {
    if (!currentCaption.trim()) return alert("Caption is required.");
    if (!editingPost && !file) return alert("Image is required.");

    setIsSaving(true);
    try {
      let finalUrl = editingPost?.image_url;
      if (file) {
        const name = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`; 
        const { error: upErr } = await supabase.storage.from('images').upload(name, file);
        if (upErr) throw upErr;
        finalUrl = supabase.storage.from('images').getPublicUrl(name).data.publicUrl;
      }
      const payload = { caption: currentCaption, image_url: finalUrl };
      const { error: dbErr } = editingPost 
        ? await supabase.from("posts").update(payload).eq("id", editingPost.id) 
        : await supabase.from("posts").insert([payload]);
      if (dbErr) throw dbErr;
      setIsModalOpen(false);
      clearForm();
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  const handleDelete = async (id: string, imageUrl: string) => {
    if (!confirm("Delete permanently?")) return;
    try {
      const bucketId = "/public/images/";
      const parts = imageUrl.split(bucketId);
      if (parts.length >= 2) {
        await supabase.storage.from('images').remove([decodeURIComponent(parts[1])]);
      }
      await supabase.from("posts").delete().eq("id", id);
    } catch (err: any) { alert(err.message); }
  };

  const clearForm = () => {
    setCaption("");
    setEditingPost(null);
  };

  return (
    <main className="max-w-[1600px] mx-auto px-4 py-6 pb-24">
      {/* 1. PORTALS (UI elements injected into your Nav Layout) */}
      <SearchBar search={search} setSearch={setSearch} setPage={setPage} hasMounted={hasMounted} />
      
      {hasMounted && isAdmin && ReactDOM.createPortal(
        <button onClick={() => {clearForm(); setIsModalOpen(true);}} className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg cursor-pointer hover:bg-blue-700 transition-colors">
          <PlusIcon className="h-5 w-5"/>
        </button>, document.getElementById("nav-right-mobile")!
      )}

      {/* 2. GALLERY GRID */}
      <Grid 
        posts={posts} 
        loading={loading} 
        pageSize={pageSize} 
        isAdmin={isAdmin} 
        allPosts={allPosts}
        onEdit={(post) => { setEditingPost(post); setCaption(post.caption); setIsModalOpen(true); }}
        onDelete={handleDelete}
        onSelect={(idx) => setSlideshowIdx(idx)}
      />

      {/* 3. PAGINATION */}
      {!loading && (
        <Pagination total={total} pageSize={pageSize} currentPage={page} setPage={setPage} />
      )}

      {/* 4. MODALS */}
      <AdminModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSave}
        isSaving={isSaving}
        caption={caption}
        setCaption={setCaption}
        editingPost={editingPost}
        clearForm={clearForm}
      />

      {slideshowIdx !== null && (
        <Lightbox 
          index={slideshowIdx} 
          items={allPosts} 
          onClose={() => setSlideshowIdx(null)} 
          setIndex={setSlideshowIdx} 
        />
      )}
    </main>
  );
}

/types/index.ts

export interface Post {
  id: string;
  image_url: string;
  caption: string;
  created_at?: string;
}

export interface GridProps {
  posts: Post[];
  allPosts: Post[];
  loading: boolean;
  pageSize: number;
  isAdmin: boolean;
  onEdit: (post: Post) => void;
  onDelete: (id: string, url: string) => void;
  onSelect: (index: number) => void;
}

/components/gallery/Grid.tsx

"use client";
import Image from "next/image";
import { PhotoIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { GridProps } from "@/types";

export default function Grid({ 
  posts, loading, pageSize, isAdmin, onEdit, onDelete, onSelect, allPosts 
}: GridProps) {
  
  // Loading Skeletons
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
        {[...Array(pageSize)].map((_, i) => (
          <div key={i} className="aspect-square bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center">
            <PhotoIcon className="h-8 w-8 text-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
      {posts.map((post) => (
        <div key={post.id} className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-all hover:shadow-lg">
          <div 
            onClick={() => onSelect(allPosts.findIndex(p => p.id === post.id))} 
            className="relative aspect-square overflow-hidden cursor-zoom-in"
          >
            <Image 
              src={post.image_url} 
              alt={post.caption} 
              fill 
              className="object-cover transition-transform duration-500 md:group-hover:scale-105" 
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
            />
            
            {isAdmin && (
              <div className="absolute bottom-2 right-2 flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); onEdit(post); }} 
                  className="p-2 bg-white/90 rounded-lg text-blue-600 hover:bg-white cursor-pointer shadow-sm transition-colors"
                >
                  <PencilSquareIcon className="h-4 w-4"/>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(post.id, post.image_url); }} 
                  className="p-2 bg-white/90 rounded-lg text-red-500 hover:bg-white cursor-pointer shadow-sm transition-colors"
                >
                  <TrashIcon className="h-4 w-4"/>
                </button>
              </div>
            )}
          </div>
          <div className="p-4 font-bold text-xs truncate text-slate-500">
            {post.caption}
          </div>
        </div>
      ))}
    </div>
  );
}