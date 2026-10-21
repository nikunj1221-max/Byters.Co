 import express from 'express';
// const express=require('express');

 const app= express();
const PORT =5000;

app.use(express.json());

app.get('/',(req,res)=>{
    res.json({message:"server is working"})
});

// comit
app.listen(PORT, ()=>{
    console.log(`server running at port ${PORT}`);
});