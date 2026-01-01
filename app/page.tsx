"use client";
import { useState, useEffect, useRef, MouseEvent } from "react";
import ReactDOM from "react-dom";
import Image from "next/image";
import { supabase } from "./lib/supabase"; 
import { 
  XMarkIcon, MagnifyingGlassIcon, PlusIcon, 
  TrashIcon, PencilSquareIcon, ChevronLeftIcon, ChevronRightIcon,
  BackspaceIcon, PhotoIcon
} from "@heroicons/react/24/outline";

interface Post {
  id: string;
  image_url: string;
  caption: string;
  created_at?: string;
}

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

  // --- DATA & REALTIME ---
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

  // Sync thumb scroll
  useEffect(() => {
    if (slideshowIdx !== null && thumbStripRef.current[slideshowIdx]) {
      thumbStripRef.current[slideshowIdx]?.scrollIntoView({ behavior: "smooth", inline: "center" });
    }
  }, [slideshowIdx]);

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

  // --- ACTIONS ---
  const handleSave = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!caption.trim()) return alert("Caption is required.");
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
      const payload = { caption, image_url: finalUrl };
      const { error: dbErr } = editingPost 
        ? await supabase.from("posts").update(payload).eq("id", editingPost.id) 
        : await supabase.from("posts").insert([payload]);
      if (dbErr) throw dbErr;
      setIsModalOpen(false);
      clearForm();
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  const deletePost = async (id: string, imageUrl: string) => {
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const moveSlide = (dir: number) => {
    setIsZoomed(false);
    setSlideshowIdx(prev => {
      if (prev === null) return null;
      const next = prev + dir;
      return (next >= 0 && next < allPosts.length) ? next : prev;
    });
  };

  return (
    <main className="max-w-[1600px] mx-auto px-4 py-6 pb-24">
      {/* 1. SEARCH PORTAL */}
      {hasMounted && document.getElementById("search-container") && ReactDOM.createPortal(
        <div className="relative w-full">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search gallery..." value={search} onChange={(e) => {setSearch(e.target.value); setPage(0);}} className="w-full pl-9 pr-10 py-3 rounded-2xl bg-slate-100 outline-none text-sm border-2 border-transparent focus:border-blue-100 transition-all" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-slate-200/50 rounded-full hover:bg-slate-200 cursor-pointer transition-colors"><XMarkIcon className="h-3.5 w-3.5 text-slate-500" /></button>}
        </div>, document.getElementById("search-container")!
      )}

      {/* 2. ADMIN ADD PORTAL */}
      {hasMounted && isAdmin && ReactDOM.createPortal(
        <button onClick={() => {clearForm(); setIsModalOpen(true);}} className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg cursor-pointer hover:bg-blue-700 transition-colors"><PlusIcon className="h-5 w-5"/></button>, document.getElementById("nav-right-mobile")!
      )}

      {/* 3. GRID (With Skeleton) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
        {loading ? (
          [...Array(pageSize)].map((_, i) => (
            <div key={i} className="aspect-square bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center">
              <PhotoIcon className="h-8 w-8 text-slate-200" />
            </div>
          ))
        ) : (
          posts.map((post) => (
            <div key={post.id} className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-all hover:shadow-lg">
              <div onClick={() => setSlideshowIdx(allPosts.findIndex(p => p.id === post.id))} className="relative aspect-square overflow-hidden cursor-zoom-in">
                <Image src={post.image_url} alt="" fill className="object-cover transition-transform duration-500 md:group-hover:scale-105" />
                {isAdmin && (
                  <div className="absolute bottom-2 right-2 flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => {e.stopPropagation(); setEditingPost(post); setCaption(post.caption); setIsModalOpen(true);}} className="p-2 bg-white/90 rounded-lg text-blue-600 hover:bg-white cursor-pointer transition-colors"><PencilSquareIcon className="h-4 w-4"/></button>
                    <button onClick={(e) => {e.stopPropagation(); deletePost(post.id, post.image_url);}} className="p-2 bg-white/90 rounded-lg text-red-500 hover:bg-white cursor-pointer transition-colors"><TrashIcon className="h-4 w-4"/></button>
                  </div>
                )}
              </div>
              <div className="p-4 font-bold text-xs truncate text-slate-500">{post.caption}</div>
            </div>
          ))
        )}
      </div>

      {/* 4. PAGINATION */}
      {!loading && total > pageSize && (
        <div className="mt-12 flex justify-center items-center gap-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-3 bg-white rounded-xl border border-slate-200 disabled:opacity-20 cursor-pointer"><ChevronLeftIcon className="h-5 w-5"/></button>
          {[...Array(Math.ceil(total / pageSize))].map((_, i) => (
            <button key={i} onClick={() => setPage(i)} className={`w-10 h-10 rounded-xl font-bold text-sm ${page === i ? "bg-blue-600 text-white shadow-md" : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50 cursor-pointer"}`}>{i + 1}</button>
          ))}
          <button disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)} className="p-3 bg-white rounded-xl border border-slate-200 disabled:opacity-20 cursor-pointer"><ChevronRightIcon className="h-5 w-5"/></button>
        </div>
      )}

      {/* 5. ADMIN MODAL (Updated for Edit Preview) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black">{editingPost ? "Update Entry" : "New Post"}</h2>
              <button onClick={clearForm} className="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full cursor-pointer hover:bg-red-100"><BackspaceIcon className="h-3 w-3 inline mr-1" />Reset</button>
            </div>

            {editingPost && (
              <div className="mb-4 relative h-32 w-full rounded-2xl overflow-hidden border-2 border-slate-100 bg-slate-50">
                <Image src={editingPost.image_url} alt="Current" fill className="object-cover opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-500 bg-white/60">CURRENT IMAGE</div>
              </div>
            )}
            
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-2">{editingPost ? "Change Image (Optional)" : "Select Image *"}</label>
            <input type="file" ref={fileInputRef} accept="image/*" className="mb-6 text-xs block w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 cursor-pointer" />
            
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-2">Caption *</label>
            <div className="relative mb-8">
              <input type="text" placeholder="Caption..." value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full p-4 pr-12 bg-slate-100 rounded-2xl outline-none border-2 border-transparent focus:border-blue-50 transition-all" />
              {caption && <button onClick={() => setCaption("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"><XMarkIcon className="h-4 w-4" /></button>}
            </div>

            <div className="flex gap-4">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 font-bold text-slate-400 cursor-pointer hover:text-slate-600 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={isSaving} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold cursor-pointer hover:bg-blue-700 disabled:opacity-50 transition-all">
                {isSaving ? "Saving..." : editingPost ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. LIGHTBOX (With Thumbstrip) */}
      {slideshowIdx !== null && allPosts[slideshowIdx] && (
        <div className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-between py-6 animate-in fade-in duration-300">
          <div className="w-full px-6 flex justify-between items-center z-[520]">
            <div className="text-white/40 text-[10px] font-mono">{slideshowIdx + 1} / {allPosts.length}</div>
            <button onClick={() => setSlideshowIdx(null)} className="p-2 text-white/60 bg-white/10 rounded-full cursor-pointer hover:text-white transition-colors"><XMarkIcon className="h-6 w-6" /></button>
          </div>
          <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden">
            <button onClick={() => moveSlide(-1)} className="absolute left-4 z-[510] text-white/30 p-4 cursor-pointer hover:text-white transition-colors"><ChevronLeftIcon className="h-10 w-10"/></button>
            <div className="relative h-full w-full flex items-center justify-center overflow-hidden" style={{ cursor: isZoomed ? 'zoom-out' : 'zoom-in' }}>
              <Image 
                src={allPosts[slideshowIdx].image_url} alt="" fill 
                className={`object-contain transition-transform duration-500 ease-in-out will-change-transform`}
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
            <button onClick={() => moveSlide(1)} className="absolute right-4 z-[510] text-white/30 p-4 cursor-pointer hover:text-white transition-colors"><ChevronRightIcon className="h-10 w-10"/></button>
          </div>
          {/* Thumbstrip */}
          <div className="w-full max-w-4xl px-4 mt-4 flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {allPosts.map((thumb, tIdx) => (
              <div 
                key={thumb.id} 
                ref={(el) => { thumbStripRef.current[tIdx] = el; }}
                onClick={() => {setSlideshowIdx(tIdx); setIsZoomed(false);}} 
                className={`relative h-14 w-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${slideshowIdx === tIdx ? "border-blue-500 scale-110" : "border-transparent opacity-40 hover:opacity-100"}`}
              >
                <Image src={thumb.image_url} alt="" fill className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}