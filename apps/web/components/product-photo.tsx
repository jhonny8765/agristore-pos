"use client";
import {useState} from 'react';
import Image from 'next/image';
import {Leaf,Package,Sprout,Wheat,Wrench} from 'lucide-react';
import type {Product} from '@agristore/domain';

export function ProductPhoto({product}:{product:Product}){
 const [failed,setFailed]=useState(false);
 const path=product.imagePath;
 const hasPhoto=!!path&&/^\/products\/[a-f0-9]{16}\.webp$/.test(path)&&!failed;
 const Icon=/feed/i.test(product.category)?Wheat:/seed/i.test(product.category)?Sprout:/tool/i.test(product.category)?Wrench:/fertiliz/i.test(product.category)?Leaf:Package;
 return <div className={hasPhoto?'product-visual':'product-visual product-no-photo'}>
  {hasPhoto?<Image src={path!} alt={product.imageLabel||product.name} width={240} height={170} unoptimized loading="lazy" onError={()=>setFailed(true)}/>:<><Icon size={30} aria-hidden="true"/><span>Photo not verified</span></>}
  {hasPhoto&&product.imageSourceUrl?.startsWith('https://')&&<a className="product-photo-source" href={product.imageSourceUrl} target="_blank" rel="noreferrer" aria-label={`Photo source for ${product.name}`} title={product.imageLabel||'Supplier product reference'}>Reference photo · pack may differ</a>}
 </div>;
}
