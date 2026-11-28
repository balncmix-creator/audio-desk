package com.balnc.audioddesk

/** Pure grid model used by native Home, independent of screen density. */
internal data class DeskTile(val id:String,val x:Int,val y:Int,val w:Int,val h:Int) {
    fun overlaps(b:DeskTile)=x<b.x+b.w&&x+w>b.x&&y<b.y+b.h&&y+h>b.y
}
internal object NativeDeskLayout {
    const val columns=4
    const val maxRows=200
    val defaults=listOf(DeskTile("clock",0,0,4,2),DeskTile("music",0,2,4,4),
        DeskTile("agenda",0,6,4,3),DeskTile("favorites",0,9,4,3),
        DeskTile("spl",0,12,4,4),DeskTile("mic",0,16,4,4))
    fun minimumHeight(id:String)=when(id){"spl","mic"->4;"agenda","favorites"->3;else->2}
    fun normalize(t:DeskTile):DeskTile {
        val w=t.w.coerceIn(2,columns);val h=t.h.coerceIn(minimumHeight(t.id),8)
        return t.copy(x=t.x.coerceIn(0,columns-w),y=t.y.coerceIn(0,maxRows-h),w=w,h=h)
    }
    /** Selected tile takes priority; conflicting items shift down deterministically. */
    fun place(items:List<DeskTile>, changed:DeskTile):List<DeskTile> {
        val target=normalize(changed)
        val out=mutableListOf(target)
        for(raw in items.filter{it.id!=target.id}.distinctBy{it.id}.sortedWith(compareBy({it.y},{it.x},{it.id}))){
            var t=normalize(raw)
            while(out.any{it.overlaps(t)}&&t.y+t.h<maxRows)t=t.copy(y=t.y+1)
            if(out.any{it.overlaps(t)})return items
            out.add(t)
        }
        return out.sortedWith(compareBy({it.y},{it.x},{it.id}))
    }
    fun restore(items:List<DeskTile>):List<DeskTile>{
        var out=emptyList<DeskTile>()
        for(t in items.filter{it.id in defaults.map{d->d.id}}.distinctBy{it.id}.take(defaults.size)){
            out=place(out,t)
        }
        return out
    }
}
internal enum class DeskGesture { NONE, SEARCH, APPS, NEWS, HOME }
internal object NativeDeskGestures {
    fun classify(dx:Float,dy:Float,threshold:Float,home:Boolean):DeskGesture {
        val ax=kotlin.math.abs(dx);val ay=kotlin.math.abs(dy)
        if(maxOf(ax,ay)<threshold)return DeskGesture.NONE
        if(ay>ax*1.45f&&dy<0&&home)return DeskGesture.SEARCH
        if(ax>ay*1.45f)return if(!home)DeskGesture.HOME else if(dx<0)DeskGesture.APPS else DeskGesture.NEWS
        return DeskGesture.NONE
    }
}
