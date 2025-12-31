"use client";
import { useState, useEffect, useRef, MouseEvent } from "react";
import ReactDOM from "react-dom";
import Image from "next/image";
import { supabase } from "./lib/supabase"; 
import { 
  XMarkIcon, MagnifyingGlassIcon, PlusIcon, 
  TrashIcon, PencilSquareIcon, ChevronLeftIcon, ChevronRightIcon,
  BackspaceIcon
} from "@heroicons/react/24/outline";

const PAGE_SIZE = 12;

interface Post {
  id: string;
  image_url: string;
  caption: string;
  created_at?: string;
}

export default function GalleryPage({ isAdmin = false }: { isAdmin?: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [search, setSearch] = useState("");
  const [slideshowIdx, setSlideshowIdx] = useState<number | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState("center");
  const [hasMounted, setHasMounted] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [caption, setCaption] = useState("");
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbStripRef = useRef<(HTMLDivElement | null)[]>([]);

  // 1. DATA FETCHING & REALTIME SYNC
  useEffect(() => {
    setHasMounted(true);
    fetchData();
    fetchAllForSlideshow();

    const channel = supabase
      .channel('realtime-gallery')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchData();
        fetchAllForSlideshow();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [search, page]);

  // 2. KEYBOARD NAVIGATION
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (slideshowIdx === null) return;
      if (e.key === "ArrowRight") moveSlide(1);
      if (e.key === "ArrowLeft") moveSlide(-1);
      if (e.key === "Escape") closeSlide();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [slideshowIdx, allPosts]);

  async function fetchData() {
    let query = supabase.from("posts").select("*", { count: "exact" });
    if (search) query = query.ilike("caption", `%${search}%`);
    const { data, count } = await query
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    setPosts(data || []);
    setTotal(count || 0);
  }

  async function fetchAllForSlideshow() {
    let query = supabase.from("posts").select("id, image_url, caption");
    if (search) query = query.ilike("caption", `%${search}%`);
    const { data } = await query.order("created_at", { ascending: false });
    setAllPosts(data || []);
  }

  const moveSlide = (dir: number) => {
    setIsZoomed(false);
    setSlideshowIdx(prev => {
      if (prev === null) return null;
      const next = prev + dir;
      return (next >= 0 && next < allPosts.length) ? next : prev;
    });
  };

  const closeSlide = () => { setSlideshowIdx(null); setIsZoomed(false); };

  const handleZoom = (e: MouseEvent) => {
    if (!isZoomed) {
      const { left, top, width, height } = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = ((e.clientX - left) / width) * 100;
      const y = ((e.clientY - top) / height) * 100;
      setZoomOrigin(`${x}% ${y}%`);
      setIsZoomed(true);
    } else { setIsZoomed(false); }
  };

  const handleSave = async () => {
    if (!caption) return alert("Caption required");
    setIsSaving(true);
    try {
      let finalUrl = editingPost?.image_url;
      if (fileInputRef.current?.files?.[0]) {
        const file = fileInputRef.current.files[0];
        // Replace spaces with underscores to avoid URL encoding issues
        const name = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`; 
        await supabase.storage.from('images').upload(name, file);
        finalUrl = supabase.storage.from('images').getPublicUrl(name).data.publicUrl;
      }
      const payload = { caption, image_url: finalUrl };
      editingPost 
        ? await supabase.from("posts").update(payload).eq("id", editingPost.id) 
        : await supabase.from("posts").insert([payload]);
      
      setIsModalOpen(false);
      clearForm();
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  const deletePost = async (id: string, imageUrl: string) => {
    if (confirm("Permanently delete this?")) {
      try {
        // 1. Precise Path Extraction
        const bucketIdentifier = "/public/images/";
        const parts = imageUrl.split(bucketIdentifier);
        
        if (parts.length >= 2) {
          const fileName = decodeURIComponent(parts[1]); 
          console.log("Attempting to delete file:", fileName);

          // 2. Remove from Storage
          const { error: storageError } = await supabase.storage
            .from('images')
            .remove([fileName]);

          if (storageError) {
            console.error("Storage Error:", storageError.message);
          }
        }

        // 3. Delete from Database
        const { error: dbError } = await supabase.from("posts").delete().eq("id", id);
        if (dbError) throw dbError;

      } catch (err: any) {
        alert("Deletion failed: " + err.message);
      }
    }
  };

  const clearForm = () => { setCaption(""); setEditingPost(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

  return (
    <main className="max-w-[1600px] mx-auto px-4 py-6 pb-24">
      {/* 1. SEARCH PORTAL */}
      {hasMounted && document.getElementById("search-container") && ReactDOM.createPortal(
        <div className="relative w-full">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search gallery..." value={search} onChange={(e) => {setSearch(e.target.value); setPage(0);}} className="w-full pl-9 pr-9 py-3 rounded-2xl bg-slate-100 outline-none text-sm border-2 border-transparent focus:border-blue-100 transition-all" />
          {search && <XMarkIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 cursor-pointer" onClick={() => setSearch("")} />}
        </div>, document.getElementById("search-container")!
      )}

      {hasMounted && isAdmin && (
        <>
          {ReactDOM.createPortal(<button onClick={() => {clearForm(); setIsModalOpen(true);}} className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg cursor-pointer"><PlusIcon className="h-5 w-5"/></button>, document.getElementById("nav-right-mobile")!)}
          {ReactDOM.createPortal(<button onClick={() => {clearForm(); setIsModalOpen(true);}} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow-lg hover:bg-blue-700 transition-all cursor-pointer"><PlusIcon className="h-5 w-5"/></button>, document.getElementById("nav-right-desktop")!)}
        </>
      )}

      {/* 2. GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
        {posts.map((post) => (
          <div key={post.id} className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-all hover:shadow-lg">
            <div onClick={() => {
              const idx = allPosts.findIndex(p => p.id === post.id);
              if (idx !== -1) setSlideshowIdx(idx);
            }} className="relative aspect-square overflow-hidden cursor-zoom-in">
              <Image src={post.image_url} alt="" fill className="object-cover transition-transform duration-500 md:group-hover:scale-105" sizes="(max-width: 640px) 100vw, 20vw" />
              {isAdmin && (
                <div className="absolute bottom-2 right-2 flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => {e.stopPropagation(); setEditingPost(post); setCaption(post.caption); setIsModalOpen(true);}} className="p-2.5 bg-white/90 rounded-lg text-blue-600 shadow-lg cursor-pointer hover:bg-white"><PencilSquareIcon className="h-4 w-4"/></button>
                  <button onClick={(e) => {e.stopPropagation(); deletePost(post.id, post.image_url);}} className="p-2.5 bg-white/90 rounded-lg text-red-500 shadow-lg cursor-pointer hover:bg-white"><TrashIcon className="h-4 w-4"/></button>
                </div>
              )}
            </div>
            <div className="p-4 font-bold text-xs truncate text-slate-500">{post.caption}</div>
          </div>
        ))}
      </div>

      {/* 3. PAGINATION */}
      {total > PAGE_SIZE && (
        <div className="mt-12 flex justify-center items-center gap-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-3 bg-white rounded-xl border border-slate-200 disabled:opacity-20 cursor-pointer hover:bg-slate-50 transition-colors"><ChevronLeftIcon className="h-5 w-5"/></button>
          {[...Array(Math.ceil(total / PAGE_SIZE))].map((_, i) => (
            <button key={i} onClick={() => setPage(i)} className={`w-11 h-11 rounded-xl font-bold text-sm cursor-pointer transition-all ${page === i ? "bg-blue-600 text-white shadow-md" : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"}`}>{i + 1}</button>
          ))}
          <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} className="p-3 bg-white rounded-xl border border-slate-200 disabled:opacity-20 cursor-pointer hover:bg-slate-50 transition-colors"><ChevronRightIcon className="h-5 w-5"/></button>
        </div>
      )}

      {/* 4. SLIDESHOW */}
      {slideshowIdx !== null && allPosts[slideshowIdx] && (
        <div className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-between py-6 select-none animate-in fade-in duration-300">
          <div className="w-full px-6 flex justify-between items-center z-[520]">
            <div className="text-white/40 text-[10px] font-mono leading-none">
              {slideshowIdx + 1} / {allPosts.length} <br/> 
              <span className="hidden md:inline uppercase tracking-tighter opacity-50">Arrows to nav • Esc to exit</span>
            </div>
            <button onClick={closeSlide} className="p-2 text-white/60 hover:text-white bg-white/10 rounded-full cursor-pointer"><XMarkIcon className="h-6 w-6" /></button>
          </div>

          <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden">
            <button onClick={() => moveSlide(-1)} className="absolute left-4 z-[510] text-white/30 hover:text-white p-4 cursor-pointer active:scale-125 transition-transform"><ChevronLeftIcon className="h-10 w-10"/></button>
            <div className="relative h-full w-full flex items-center justify-center overflow-hidden" style={{ cursor: isZoomed ? 'zoom-out' : 'zoom-in' }}>
              <Image src={allPosts[slideshowIdx]?.image_url || ''} alt="" fill onClick={handleZoom} className="object-contain transition-transform duration-300" style={{ transform: isZoomed ? 'scale(2.5)' : 'scale(1)', transformOrigin: zoomOrigin }} />
            </div>
            <button onClick={() => moveSlide(1)} className="absolute right-4 z-[510] text-white/30 hover:text-white p-4 cursor-pointer active:scale-125 transition-transform"><ChevronRightIcon className="h-10 w-10"/></button>
          </div>

          <div className="w-full max-w-4xl px-4 mt-4">
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide snap-x">
              {allPosts.map((thumb, tIdx) => (
                <div key={thumb.id} ref={(el) => { thumbStripRef.current[tIdx] = el; }} onClick={() => {setSlideshowIdx(tIdx); setIsZoomed(false);}} className={`relative h-14 w-14 shrink-0 rounded-lg overflow-hidden snap-center border-2 transition-all cursor-pointer ${slideshowIdx === tIdx ? "border-blue-500 scale-110" : "border-transparent opacity-40 hover:opacity-100"}`}>
                  <Image src={thumb.image_url} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. ADMIN MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black">{editingPost ? "Update Entry" : "New Post"}</h2>
              <button onClick={clearForm} className="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full cursor-pointer hover:bg-red-100"><BackspaceIcon className="h-3 w-3 inline mr-1" />Full Reset</button>
            </div>
            <input type="file" ref={fileInputRef} className="mb-6 text-xs block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 cursor-pointer" />
            <div className="relative mb-8">
              <input type="text" placeholder="Add a caption..." value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full p-4 pr-12 bg-slate-100 rounded-2xl outline-none border-2 border-transparent focus:border-blue-50 transition-all" />
              {caption && (
                <button onClick={() => setCaption("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-slate-200/50 rounded-full p-1"><XMarkIcon className="h-4 w-4" /></button>
              )}
            </div>
            <div className="flex gap-4">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-bold text-slate-400 cursor-pointer hover:text-slate-600">Cancel</button>
              <button onClick={handleSave} disabled={isSaving} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold cursor-pointer hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{isSaving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}