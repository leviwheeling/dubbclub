"use client";
import {useState,type FormEvent} from "react";
import {Arrow} from "./icons";
export function Signup({id="drop-list"}:{id?:string}) {
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [success,setSuccess]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setMessage("");
    const form=event.currentTarget;
    try {
      const email=new FormData(form).get("email");
      const result=await fetch("/api/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
      const data=await result.json();
      if (!result.ok) throw new Error(data.error);
      setSuccess(true);setMessage("You’re on the list.");form.reset();
    } catch(error) {setMessage(error instanceof Error?error.message:"Try again in a moment.");}
    finally{setBusy(false);}
  }
  return <section className="signup-block" id={id}>
    <div><h2>Get the drop.</h2><p>New gear and release dates, straight to your inbox.</p></div>
    <div><form className="signup-form" onSubmit={submit}><label className="sr-only" htmlFor={`${id}-email`}>Email address</label>
      <input id={`${id}-email`} type="email" name="email" placeholder="Your email address" required maxLength={254}/>
      <button type="submit" aria-label="Join the drop list" disabled={busy||success}><Arrow/></button>
    </form><p className="form-message" aria-live="polite">{message||"By joining, you agree to receive drop emails. Unsubscribe anytime."}</p></div>
  </section>;
}
