package com.balnc.audioddesk

import org.junit.Assert.*
import org.junit.Test

class NativeDeskLayoutTest {
    @Test fun movementAndResizeDoNotOverlap(){
        val initial=NativeDeskLayout.defaults
        val requested=DeskTile("music",0,0,4,6)
        val result=NativeDeskLayout.place(initial,requested)
        assertEquals(initial.map{it.id}.toSet(),result.map{it.id}.toSet())
        assertEquals(requested,result.first{it.id=="music"})
        for(a in result)for(b in result)if(a.id!=b.id)assertFalse("${a.id} overlaps ${b.id}",a.overlaps(b))
        assertTrue(result.all{it.x>=0&&it.y>=0&&it.x+it.w<=4&&it.y+it.h<=NativeDeskLayout.maxRows})
    }
    @Test fun minimumDimensionsAndInvalidPositionsAreClamped(){
        assertEquals(DeskTile("spl",2,0,2,4),NativeDeskLayout.normalize(DeskTile("spl",99,-10,1,1)))
        assertEquals(DeskTile("clock",0,192,4,8),NativeDeskLayout.normalize(DeskTile("clock",-2,999,12,12)))
    }
    @Test fun restoredLayoutRemovesUnknownAndDuplicateIds(){
        val values=NativeDeskLayout.defaults+DeskTile("clock",1,2,2,2)+DeskTile("invalid",0,0,2,2)
        val restored=NativeDeskLayout.restore(values)
        assertEquals(6,restored.size);assertEquals(NativeDeskLayout.defaults,restored)
    }
    @Test fun nativeEdgeResizeAnchorsAndMoveSnap(){
        val initial=DeskTile("music",1,4,3,4)
        assertEquals(DeskTile("music",2,5,2,3),NativeDeskLayout.edit(initial,"nw",1,1))
        assertEquals(DeskTile("music",0,4,3,4),NativeDeskLayout.edit(initial,"move",-8,0))
        assertEquals(DeskTile("music",1,4,3,2),NativeDeskLayout.edit(initial,"s",0,-10))
        assertEquals(DeskTile("spl",0,3,4,4),NativeDeskLayout.edit(DeskTile("spl",0,3,4,4),"s",0,-2))
        val moved=NativeDeskLayout.place(NativeDeskLayout.defaults,NativeDeskLayout.edit(initial,"move",0,-4))
        assertTrue(moved.indices.all{i->moved.indices.all{j->i==j||!moved[i].overlaps(moved[j])}})
    }
    @Test fun gesturesHaveDirectionAndThreshold(){
        assertEquals(DeskGesture.NONE,NativeDeskGestures.classify(15f,-20f,70f,true))
        assertEquals(DeskGesture.NONE,NativeDeskGestures.classify(90f,-100f,70f,true))
        assertEquals(DeskGesture.SEARCH,NativeDeskGestures.classify(8f,-150f,70f,true))
        assertEquals(DeskGesture.APPS,NativeDeskGestures.classify(-150f,8f,70f,true))
        assertEquals(DeskGesture.NEWS,NativeDeskGestures.classify(150f,8f,70f,true))
        assertEquals(DeskGesture.HOME,NativeDeskGestures.classify(-150f,8f,70f,false))
    }
}
