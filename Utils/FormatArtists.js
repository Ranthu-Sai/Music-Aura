export default function FormatArtist(data){
  if (!data) return "";
  if (typeof data === 'string') return data;
  if (!Array.isArray(data)) return "";
  
  let artist = ""
  data.forEach((e,i)=>{
    let name = "";
    if (typeof e === 'string') {
      name = e;
    } else if (e?.name) {
      name = e.name;
    } else if (e?.title) {
      name = e.title;
    } else if (e?.artist) {
      name = e.artist;
    } else {
      name = "";
    }
    if (name) {
      if (i === data.length - 1){
        artist += name;
      } else {
        artist += name + ", ";
      }
    }
  })
  return artist || "Unknown Artist";
}
