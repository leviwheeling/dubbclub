"use client";

import Image from "next/image";
import {useEffect,useRef,useState} from "react";

const chapters=[
  {
    id:"the-name",
    label:"The name",
    title:"Count the small wins.",
    copy:"One more rep. A first run back. Making it through the door after a long day. A dub can be any of those. You decide what counts.",
    image:"/images/hoodie-black.webp",
    position:"50% 50%",
  },
  {
    id:"the-work",
    label:"The work",
    title:"Gear you’ll reach for again.",
    copy:"We like easy shapes, room to move, and details that stay quiet. Pieces you can pull on for a training day and keep on for everything after.",
    image:"/images/pump-cover.webp",
    position:"50% 38%",
  },
  {
    id:"the-club",
    label:"The club",
    title:"Different goals. Same room.",
    copy:"Everyone comes in with something of their own to work on. The club is for people who show up for themselves and make room for somebody else to do the same.",
    image:"/images/campaign.webp",
    position:"46% 50%",
  },
];

export function ClubStory() {
  const story=useRef<HTMLDivElement>(null);
  const [active,setActive]=useState(0);

  useEffect(()=>{
    if (!story.current || !("IntersectionObserver" in window)) return;
    const observer=new IntersectionObserver(entries=>{
      const entering=entries.find(entry=>entry.intersectionRatio>=.55);
      if (entering) setActive(Number((entering.target as HTMLElement).dataset.chapter));
    },{threshold:.55});
    story.current.querySelectorAll("[data-chapter]").forEach(chapter=>observer.observe(chapter));
    return ()=>observer.disconnect();
  },[]);

  return <div className="wrap club-story" ref={story}>
    <div className="story-visual" aria-hidden="true">
      <div className="story-photo">
        {chapters.map((chapter,index)=><Image
          key={chapter.id} src={chapter.image} alt="" fill sizes="(max-width: 760px) 1px, 47vw"
          style={{objectPosition:chapter.position}} data-active={active===index}
        />)}
      </div>
      <div className="story-caption">
        <span className="eyebrow">{chapters[active].label}</span>
        <span className="story-steps">{chapters.map((chapter,index)=><span key={chapter.id} data-active={active===index}/>)}</span>
      </div>
    </div>

    <div className="story-chapters">
      {chapters.map((chapter,index)=><section className="story-chapter" key={chapter.id} id={chapter.id} data-chapter={index}>
        <div className="story-mobile-photo" aria-hidden="true">
          <Image src={chapter.image} alt="" fill sizes="(max-width: 760px) 94vw, 70vw" style={{objectPosition:chapter.position}}/>
        </div>
        <div className="story-copy">
          <p className="eyebrow">{chapter.label}</p>
          <h2>{chapter.title}</h2>
          <p>{chapter.copy}</p>
        </div>
      </section>)}
    </div>
  </div>;
}
